import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getRule } from '../config/rules';
import { recordDeclareEvents } from '../lib/events';

export interface DeclareRuleArgs {
  tournament_id: string;
  rule_key: string;
  primary_player_number: number;
  hole_id: string;
  card_number?: number | null;
  partner_player_numbers?: number[] | null;
  target_player_number?: number | null;
  /** Optional display metadata for the activity feed. */
  primary_display_name?: string;
  target_display_name?: string;
  hole_number?: number;
  course_id?: string;
}

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

  const rule = getRule(args.rule_key);
  await recordDeclareEvents({
    tournament_id: args.tournament_id,
    rule_key: args.rule_key,
    rule_emoji: rule?.emoji ?? null,
    rule_display_name: rule?.displayName ?? null,
    primary_player_number: args.primary_player_number,
    primary_display_name: args.primary_display_name,
    target_player_number: args.target_player_number,
    target_display_name: args.target_display_name,
    hole_id: args.hole_id,
    hole_number: args.hole_number,
    course_id: args.course_id,
    card_number: args.card_number,
  });
}

export function useDeclareRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declareRule,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['rule-activations', vars.tournament_id] });
      qc.invalidateQueries({ queryKey: ['activity-events', vars.tournament_id] });
    },
  });
}
