import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useActiveTournament } from './useActiveTournament';
import type { ActivityEvent } from '../types/database';

async function fetchActivityEvents(tournament_id: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('tournament_id', tournament_id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ActivityEvent[];
}

export function useActivityEvents() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;
  return useQuery({
    queryKey: ['activity-events', tournament_id],
    queryFn: () => fetchActivityEvents(tournament_id!),
    enabled: !!tournament_id,
    staleTime: 5_000,
  });
}
