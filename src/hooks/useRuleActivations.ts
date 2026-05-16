import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useActiveTournament } from './useActiveTournament';
import type { RuleActivation } from '../types/database';

async function fetchRuleActivations(tournament_id: string): Promise<RuleActivation[]> {
  const { data, error } = await supabase
    .from('rule_activations')
    .select('*')
    .eq('tournament_id', tournament_id);
  if (error) throw error;
  return (data ?? []) as RuleActivation[];
}

export function useRuleActivations() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;
  return useQuery({
    queryKey: ['rule-activations', tournament_id],
    queryFn: () => fetchRuleActivations(tournament_id!),
    enabled: !!tournament_id,
    staleTime: 5_000,
  });
}
