import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Tournament } from '../types/database';

async function fetchActiveTournament(): Promise<Tournament> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error) throw error;
  if (!data) throw new Error('No active tournament found. Did you run the seed SQL?');
  return data as Tournament;
}

export function useActiveTournament() {
  return useQuery({
    queryKey: ['active-tournament'],
    queryFn: fetchActiveTournament,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
