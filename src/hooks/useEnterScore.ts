import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getRule, type RuleOutcome } from '../config/rules';

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

/** When saving Justin's score, look for activations where Justin was named as
 * a partner by someone else on his card. Used to propagate the partner's
 * delta into Justin's score automatically. */
async function findIncomingPartnerDelta(
  tournament_id: string,
  player_number: number,
  hole_id: string,
  strokes: number,
  par: number,
): Promise<number> {
  const { data, error } = await supabase
    .from('rule_activations')
    .select('rule_key, partner_player_numbers')
    .eq('tournament_id', tournament_id)
    .eq('hole_id', hole_id)
    .not('partner_player_numbers', 'is', null);
  if (error) throw error;

  for (const row of data ?? []) {
    const partners = (row.partner_player_numbers as number[] | null) ?? [];
    if (!partners.includes(player_number)) continue;
    const rule = getRule(row.rule_key);
    if (!rule) continue;
    const outcome: RuleOutcome = { strokes, par };
    return rule.computeDelta(outcome);
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

  // 2. Drop any existing PRIMARY activation for this (player, hole). Partner
  // activations (where someone else is primary) stay untouched.
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

    // 4. If the rule names partners and they already have a score on this
    // hole, push the partner's delta into their row too. Each partner's
    // delta is computed from THEIR strokes (caddie_shack: par-or-better
    // is per player; going_steady: flat -3 for all).
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
          const partnerDelta = ruleSpec.computeDelta({
            strokes: ps.strokes,
            par: ps.par_snapshot,
          });
          const { error: upErr } = await supabase
            .from('scores')
            .update({ rule_delta: partnerDelta })
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
