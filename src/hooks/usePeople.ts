import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Person } from '../types/database';

async function fetchPeople(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('people')
    .select('*')
    .order('display_name');

  if (error) throw error;
  return (data ?? []) as Person[];
}

export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: fetchPeople,
    staleTime: 60_000,
  });
}
