/** Phase 16 hole-complete detection.
 *
 * After every score save, two checks fire:
 *  1. runHoleCompleteDetection: if all N players have scored this hole,
 *     emits the exclusive_ace / exclusive_eagle / exclusive_birdie events
 *     and the hardest_hole / easiest_hole avg-based events. Dedup via the
 *     partial unique index from migrations/002 — re-running is a no-op.
 *  2. applyGentlemensTeeBonus: if any card has a Gentlemen's Tee
 *     declaration for this hole AND the whole card has scored AND every
 *     score is bogey-or-better, applies -1 to each card-player's
 *     rule_delta. Marks the activation as evaluated either way so a
 *     subsequent score save doesn't re-evaluate. */

import { supabase } from './supabase';
import type { ActivityEventType, CourseId } from '../types/database';

const PG_UNIQUE_VIOLATION = '23505';

interface HoleInfo {
  hole_id: string;
  hole_number: number;
  course_id: CourseId;
  par: number;
}

async function fetchHoleInfo(hole_id: string): Promise<HoleInfo | null> {
  const { data, error } = await supabase
    .from('holes')
    .select('id, hole_number, course_id, par')
    .eq('id', hole_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    hole_id: data.id,
    hole_number: data.hole_number,
    course_id: data.course_id as CourseId,
    par: data.par,
  };
}

async function tryInsertOneShotEvent(row: {
  tournament_id: string;
  event_type: ActivityEventType;
  player_number: number | null;
  hole_id: string;
  payload: Record<string, unknown>;
}) {
  const { error } = await supabase.from('activity_events').insert(row);
  if (error && (error as { code?: string }).code !== PG_UNIQUE_VIOLATION) {
    throw error;
  }
}

export async function runHoleCompleteDetection(
  tournament_id: string,
  hole_id: string,
) {
  // 1. How many players are in this tournament right now?
  const { data: players, error: pErr } = await supabase
    .from('tournament_players')
    .select('player_number, display_name')
    .eq('tournament_id', tournament_id);
  if (pErr) throw pErr;
  if (!players || players.length === 0) return;
  const N = players.length;
  const nameByNum = new Map(players.map((p) => [p.player_number, p.display_name]));

  // 2. Scores on this hole.
  const { data: scores, error: sErr } = await supabase
    .from('scores')
    .select('player_number, strokes, hole_score_to_par')
    .eq('tournament_id', tournament_id)
    .eq('hole_id', hole_id);
  if (sErr) throw sErr;
  if (!scores || scores.length < N) return;

  // 3. Hole metadata for the event payload.
  const hole = await fetchHoleInfo(hole_id);
  const sharedPayload = (winner: number | null) => ({
    player_display_name: winner != null ? nameByNum.get(winner) : null,
    hole_number: hole?.hole_number,
    course_id: hole?.course_id,
  });

  // 4. Exclusivity (exactly one).
  const aces = scores.filter((s) => s.strokes === 1);
  if (aces.length === 1) {
    await tryInsertOneShotEvent({
      tournament_id,
      event_type: 'exclusive_ace',
      player_number: aces[0].player_number,
      hole_id,
      payload: sharedPayload(aces[0].player_number),
    });
  }

  const eagles = scores.filter(
    (s) => s.strokes > 1 && s.hole_score_to_par <= -2,
  );
  if (eagles.length === 1) {
    await tryInsertOneShotEvent({
      tournament_id,
      event_type: 'exclusive_eagle',
      player_number: eagles[0].player_number,
      hole_id,
      payload: sharedPayload(eagles[0].player_number),
    });
  }

  const birdies = scores.filter((s) => s.hole_score_to_par === -1);
  if (birdies.length === 1) {
    await tryInsertOneShotEvent({
      tournament_id,
      event_type: 'exclusive_birdie',
      player_number: birdies[0].player_number,
      hole_id,
      payload: sharedPayload(birdies[0].player_number),
    });
  }

  // 5. Hardest / easiest by avg to-par.
  const sumToPar = scores.reduce((acc, s) => acc + s.hole_score_to_par, 0);
  const avgToPar = sumToPar / scores.length;
  if (avgToPar >= 1.5) {
    await tryInsertOneShotEvent({
      tournament_id,
      event_type: 'hardest_hole',
      player_number: null,
      hole_id,
      payload: { ...sharedPayload(null), avg_to_par: avgToPar },
    });
  } else if (avgToPar <= -0.5) {
    await tryInsertOneShotEvent({
      tournament_id,
      event_type: 'easiest_hole',
      player_number: null,
      hole_id,
      payload: { ...sharedPayload(null), avg_to_par: avgToPar },
    });
  }
}

export async function applyGentlemensTeeBonus(
  tournament_id: string,
  hole_id: string,
) {
  const { data: activations, error: aErr } = await supabase
    .from('rule_activations')
    .select('id, card_number, outcome')
    .eq('tournament_id', tournament_id)
    .eq('rule_key', 'the_gentlemens_tee')
    .eq('hole_id', hole_id);
  if (aErr) throw aErr;
  if (!activations || activations.length === 0) return;

  for (const act of activations) {
    if ((act.outcome as { applied?: boolean } | null)?.applied) continue;
    const cardNumber = act.card_number;
    if (cardNumber == null) continue;

    const { data: cardPlayers, error: cpErr } = await supabase
      .from('tournament_players')
      .select('player_number')
      .eq('tournament_id', tournament_id)
      .eq('card_number', cardNumber);
    if (cpErr) throw cpErr;
    if (!cardPlayers || cardPlayers.length === 0) continue;

    const cardPlayerNums = cardPlayers.map((p) => p.player_number);

    const { data: cardScores, error: csErr } = await supabase
      .from('scores')
      .select('player_number, hole_score_to_par, rule_delta')
      .eq('tournament_id', tournament_id)
      .eq('hole_id', hole_id)
      .in('player_number', cardPlayerNums);
    if (csErr) throw csErr;
    if (!cardScores || cardScores.length < cardPlayerNums.length) continue;

    const allBogeyOrBetter = cardScores.every(
      (s) => s.hole_score_to_par <= 1,
    );

    const prevOutcome = (act.outcome as Record<string, unknown> | null) ?? {};

    if (!allBogeyOrBetter) {
      // Whole card scored but the condition wasn't met — mark evaluated
      // so we don't repeat the work next time.
      const { error: uErr } = await supabase
        .from('rule_activations')
        .update({
          outcome: { ...prevOutcome, applied: true, granted: false },
          delta_applied: 0,
        })
        .eq('id', act.id);
      if (uErr) throw uErr;
      continue;
    }

    // Condition met. Add -1 to every card-player's rule_delta.
    for (const s of cardScores) {
      const { error: upErr } = await supabase
        .from('scores')
        .update({ rule_delta: (s.rule_delta ?? 0) - 1 })
        .eq('tournament_id', tournament_id)
        .eq('player_number', s.player_number)
        .eq('hole_id', hole_id);
      if (upErr) throw upErr;
    }

    const { error: uErr } = await supabase
      .from('rule_activations')
      .update({
        outcome: { ...prevOutcome, applied: true, granted: true },
        delta_applied: -1,
      })
      .eq('id', act.id);
    if (uErr) throw uErr;
  }
}
