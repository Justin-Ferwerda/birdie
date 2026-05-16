import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getRule, type Rule, type RuleOutcome } from '../config/rules';
import { recordScoreEvents } from '../lib/events';

export interface RuleActivationInput {
  rule_key: string;
  outcome?: Record<string, unknown> | null;
  partner_player_numbers?: number[] | null;
  target_player_number?: number | null;
  card_number?: number | null;
}

export interface EnterScoreArgs {
  tournament_id: string;
  player_number: number;
  hole_id: string;
  par_snapshot: number;
  strokes: number;
  rule_delta: number;
  entered_by_player_number: number;
  rule?: RuleActivationInput;
  /** Optional display metadata so the activity feed can render without joins. */
  player_display_name?: string;
  hole_number?: number;
  course_id?: string;
}

async function partnerDelta(
  rule: Rule,
  partnerOwn: RuleOutcome,
  tournament_id: string,
  primaryPlayerNumber: number,
  hole_id: string,
): Promise<number> {
  if ((rule.partnerDeltaSource ?? 'self') === 'self') {
    return rule.computeDelta(partnerOwn);
  }
  const { data, error } = await supabase
    .from('scores')
    .select('strokes, par_snapshot')
    .eq('tournament_id', tournament_id)
    .eq('player_number', primaryPlayerNumber)
    .eq('hole_id', hole_id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return 0;
  return rule.computeDelta({ strokes: data.strokes, par: data.par_snapshot });
}

/** Pending Shotgun activations get consumed on the player's next Crockett
 *  hole — pulls the delta in, marks the activation no longer pending,
 *  stamps it with this hole_id so it isn't double-counted. */
async function findAndConsumeShotgun(
  tournament_id: string,
  player_number: number,
  hole_id: string,
  course_id: string | undefined,
): Promise<number> {
  if (course_id !== 'crockett') return 0;

  const { data, error } = await supabase
    .from('rule_activations')
    .select('id, outcome, delta_applied')
    .eq('tournament_id', tournament_id)
    .eq('primary_player_number', player_number)
    .eq('rule_key', 'the_shotgun')
    .is('hole_id', null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return 0;

  const delta = data.delta_applied ?? 0;
  const outcome = (data.outcome as Record<string, unknown> | null) ?? {};
  const { error: uErr } = await supabase
    .from('rule_activations')
    .update({
      hole_id,
      outcome: { ...outcome, pending: false, consumed_at: new Date().toISOString() },
    })
    .eq('id', data.id);
  if (uErr) throw uErr;

  return delta;
}

async function findIncomingPartnerDelta(
  tournament_id: string,
  player_number: number,
  hole_id: string,
  strokes: number,
  par: number,
): Promise<number> {
  const { data, error } = await supabase
    .from('rule_activations')
    .select('rule_key, primary_player_number, partner_player_numbers')
    .eq('tournament_id', tournament_id)
    .eq('hole_id', hole_id)
    .not('partner_player_numbers', 'is', null);
  if (error) throw error;

  for (const row of data ?? []) {
    const partners = (row.partner_player_numbers as number[] | null) ?? [];
    if (!partners.includes(player_number)) continue;
    const rule = getRule(row.rule_key);
    if (!rule) continue;
    return partnerDelta(
      rule,
      { strokes, par },
      tournament_id,
      row.primary_player_number,
      hole_id,
    );
  }
  return 0;
}

async function enterScore(args: EnterScoreArgs) {
  const {
    tournament_id,
    player_number,
    hole_id,
    strokes,
    par_snapshot,
    rule_delta,
    entered_by_player_number,
    rule,
  } = args;

  let appliedDelta = rule_delta;
  if (!rule) {
    appliedDelta = await findIncomingPartnerDelta(
      tournament_id,
      player_number,
      hole_id,
      strokes,
      par_snapshot,
    );
  }

  // Pending Shotgun bonus auto-applies on the player's first Crockett hole
  // after the Shotgun fired. It stacks with the player's own picked rule
  // (Marshmallow on this hole + -1 Shotgun → -2 total rule_delta).
  const shotgunDelta = await findAndConsumeShotgun(
    tournament_id,
    player_number,
    hole_id,
    args.course_id,
  );
  appliedDelta += shotgunDelta;

  const { error: sErr } = await supabase
    .from('scores')
    .upsert(
      {
        tournament_id,
        player_number,
        hole_id,
        strokes,
        par_snapshot,
        rule_delta: appliedDelta,
        entered_by_player_number,
      },
      { onConflict: 'tournament_id,player_number,hole_id' },
    );
  if (sErr) throw sErr;

  const { error: dErr } = await supabase
    .from('rule_activations')
    .delete()
    .eq('tournament_id', tournament_id)
    .eq('primary_player_number', player_number)
    .eq('hole_id', hole_id);
  if (dErr) throw dErr;

  let ruleSpec: Rule | undefined;
  if (rule) {
    ruleSpec = getRule(rule.rule_key);
    const { error: rErr } = await supabase.from('rule_activations').insert({
      tournament_id,
      rule_key: rule.rule_key,
      primary_player_number: player_number,
      target_player_number: rule.target_player_number ?? null,
      partner_player_numbers: rule.partner_player_numbers ?? null,
      card_number: rule.card_number ?? null,
      hole_id,
      outcome: rule.outcome ?? null,
      delta_applied: rule_delta,
    });
    if (rErr) throw rErr;

    if (rule.partner_player_numbers && rule.partner_player_numbers.length > 0 && ruleSpec) {
      const { data: partnerScores, error: psErr } = await supabase
        .from('scores')
        .select('player_number, strokes, par_snapshot')
        .eq('tournament_id', tournament_id)
        .eq('hole_id', hole_id)
        .in('player_number', rule.partner_player_numbers);
      if (psErr) throw psErr;
      for (const ps of partnerScores ?? []) {
        const delta = await partnerDelta(
          ruleSpec,
          { strokes: ps.strokes, par: ps.par_snapshot },
          tournament_id,
          player_number,
          hole_id,
        );
        const { error: upErr } = await supabase
          .from('scores')
          .update({ rule_delta: delta })
          .eq('tournament_id', tournament_id)
          .eq('player_number', ps.player_number)
          .eq('hole_id', hole_id);
        if (upErr) throw upErr;
      }
    }
  }

  // Fire activity events for the score + rule (Phase 8).
  await recordScoreEvents({
    tournament_id,
    player_number,
    hole_id,
    strokes,
    par: par_snapshot,
    rule_key: rule?.rule_key ?? null,
    rule_emoji: ruleSpec?.emoji ?? null,
    rule_display_name: ruleSpec?.displayName ?? null,
    rule_outcome: rule?.outcome ?? null,
    player_display_name: args.player_display_name,
    hole_number: args.hole_number,
    course_id: args.course_id,
  });
}

export function useEnterScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enterScore,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['scores', vars.tournament_id] });
      queryClient.invalidateQueries({ queryKey: ['rule-activations', vars.tournament_id] });
      queryClient.invalidateQueries({ queryKey: ['activity-events', vars.tournament_id] });
    },
  });
}
