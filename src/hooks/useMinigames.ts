import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useActiveTournament } from './useActiveTournament';
import type { Minigame } from '../types/database';

async function fetchMinigames(tournament_id: string): Promise<Minigame[]> {
  const { data, error } = await supabase
    .from('minigames')
    .select('*')
    .eq('tournament_id', tournament_id)
    .order('play_order');
  if (error) throw error;
  return (data ?? []) as Minigame[];
}

export function useMinigames() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;
  return useQuery({
    queryKey: ['minigames', tournament_id],
    queryFn: () => fetchMinigames(tournament_id!),
    enabled: !!tournament_id,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
