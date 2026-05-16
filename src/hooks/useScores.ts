import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useActiveTournament } from './useActiveTournament';
import type { Score } from '../types/database';

async function fetchScores(tournament_id: string): Promise<Score[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('tournament_id', tournament_id);
  if (error) throw error;
  return (data ?? []) as Score[];
}

export function useScores() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;
  return useQuery({
    queryKey: ['scores', tournament_id],
    queryFn: () => fetchScores(tournament_id!),
    enabled: !!tournament_id,
    staleTime: 5_000,
  });
}
