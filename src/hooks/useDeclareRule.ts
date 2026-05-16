import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface DeclareRuleArgs {
  tournament_id: string;
  rule_key: string;
  primary_player_number: number;
  hole_id: string;
  card_number?: number | null;
  partner_player_numbers?: number[] | null;
  target_player_number?: number | null;
}

/** Writes a rule_activation with no score-linked outcome. Used by:
 *  - Pre-declared rules (birdie_for_shurdy, scramble_up, gentlemens_tee)
 *  - Cross-card sabotage (putter_sabotage)
 *  - Whole-card non-mustDeclare (play_through_parade)
 *
 * No score row is touched here — the declaration is the side effect.
 * Outcome / delta_applied get filled in later, either by the player's
 * score entry (for primary-owned activations) or by Phase 16 detection. */
async function declareRule(args: DeclareRuleArgs) {
  const { error } = await supabase.from('rule_activations').insert({
    tournament_id: args.tournament_id,
    rule_key: args.rule_key,
    primary_player_number: args.primary_player_number,
    hole_id: args.hole_id,
    card_number: args.card_number ?? null,
    partner_player_numbers: args.partner_player_numbers ?? null,
    target_player_number: args.target_player_number ?? null,
    outcome: null,
    delta_applied: null,
  });
  if (error) throw error;
}

export function useDeclareRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declareRule,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rule-activations', vars.tournament_id] });
    },
  });
}
