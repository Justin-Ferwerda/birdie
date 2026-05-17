import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useActiveTournament } from './useActiveTournament';
import type { MinigamePlacement } from '../types/database';

async function fetchMinigamePlacements(
  tournament_id: string,
): Promise<MinigamePlacement[]> {
  const { data, error } = await supabase
    .from('minigame_placements')
    .select('*')
    .eq('tournament_id', tournament_id);
  if (error) throw error;
  return (data ?? []) as MinigamePlacement[];
}

export function useMinigamePlacements() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;
  return useQuery({
    queryKey: ['minigame-placements', tournament_id],
    queryFn: () => fetchMinigamePlacements(tournament_id!),
    enabled: !!tournament_id,
    staleTime: 5_000,
  });
}
