import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface RuleActivationInput {
  rule_key: string;
  outcome?: Record<string, unknown> | null;
  /** Players the rule's delta also applies to. Phase 7 territory. */
  partner_player_numbers?: number[] | null;
  /** Other-card victim. Phase 7 territory (Putter Sabotage). */
  target_player_number?: number | null;
  /** Whole-card rules. Phase 7. */
  card_number?: number | null;
}

export interface EnterScoreArgs {
  tournament_id: string;
  player_number: number;
  hole_id: string;
  strokes: number;
  par_snapshot: number;
  rule_delta: number;
  entered_by_player_number: number;
  /** If set, replaces any existing rule activation on this (player, hole). */
  rule?: RuleActivationInput;
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

  // 1. Upsert the score row. Re-tap on the same cell overwrites cleanly.
  const { error: sErr } = await supabase
    .from('scores')
    .upsert(
      {
        tournament_id,
        player_number,
        hole_id,
        strokes,
        par_snapshot,
        rule_delta,
        entered_by_player_number,
      },
      { onConflict: 'tournament_id,player_number,hole_id' },
    );
  if (sErr) throw sErr;

  // 2. Drop any existing rule activation for this (player, hole). The spec
  // is "one rule per player per hole" — re-saving from the entry sheet
  // replaces whatever was there.
  const { error: dErr } = await supabase
    .from('rule_activations')
    .delete()
    .eq('tournament_id', tournament_id)
    .eq('primary_player_number', player_number)
    .eq('hole_id', hole_id);
  if (dErr) throw dErr;

  // 3. Insert the new rule activation if the user picked one.
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
