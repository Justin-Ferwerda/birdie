import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useActiveTournament } from './useActiveTournament';
import type { TournamentPlayer, Person } from '../types/database';

export type TournamentPlayerWithPerson = TournamentPlayer & {
  person: Pick<Person, 'id' | 'display_name' | 'avatar_id'> | null;
};

async function fetchTournamentPlayers(
  tournament_id: string,
): Promise<TournamentPlayerWithPerson[]> {
  const { data, error } = await supabase
    .from('tournament_players')
    .select('*, person:people(id, display_name, avatar_id)')
    .eq('tournament_id', tournament_id)
    .order('player_number');
  if (error) throw error;
  return (data ?? []) as TournamentPlayerWithPerson[];
}

export function useTournamentPlayers() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;
  return useQuery({
    queryKey: ['tournament-players', tournament_id],
    queryFn: () => fetchTournamentPlayers(tournament_id!),
    enabled: !!tournament_id,
    staleTime: 60_000,
  });
}
