import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getRule, type Rule, type RuleOutcome } from '../config/rules';

export interface RuleActivationInput {
  rule_key: string;
  outcome?: Record<string, unknown> | null;
  /** For multi_player rules: the OTHER player(s) who share the rule. */
  partner_player_numbers?: number[] | null;
  /** For cross_card_target rules: the victim on another card. */
  target_player_number?: number | null;
  /** For whole_card rules. */
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
  /** If set, replaces any existing primary activation on this (player, hole). */
  rule?: RuleActivationInput;
}

/** Compute a partner's delta from the appropriate source: their own strokes
 *  (default) or the primary's strokes (caddie_shack-style rules). */
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
  // 'primary': look up primary's score; if not entered yet, delta is 0
  // (and the primary's later save will retroactively patch partner deltas).
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

/** When saving Justin's score, look for activations where Justin was named as
 *  a partner by someone else. */
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

  // If this player wasn't picking a rule themselves but their card-mate
  // named them as a partner, that partner-delta wins.
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

  // 1. Upsert the score row.
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

  // 2. Drop any existing PRIMARY activation for this (player, hole).
  const { error: dErr } = await supabase
    .from('rule_activations')
    .delete()
    .eq('tournament_id', tournament_id)
    .eq('primary_player_number', player_number)
    .eq('hole_id', hole_id);
  if (dErr) throw dErr;

  // 3. Insert the new primary activation if the user picked one.
  if (rule) {
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

    // 4. Propagate to any partners who already have scores on this hole.
    if (rule.partner_player_numbers && rule.partner_player_numbers.length > 0) {
      const ruleSpec = getRule(rule.rule_key);
      if (ruleSpec) {
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
            player_number, // the primary
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
  }
}

export function useEnterScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enterScore,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['scores', vars.tournament_id] });
      queryClient.invalidateQueries({ queryKey: ['rule-activations', vars.tournament_id] });
    },
  });
}
