import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Hole } from '../types/database';

async function fetchHoles(): Promise<Hole[]> {
  const { data, error } = await supabase
    .from('holes')
    .select('*')
    .order('course_id')
    .order('hole_number');

  if (error) throw error;
  return (data ?? []) as Hole[];
}

export function useHoles() {
  return useQuery({
    queryKey: ['holes'],
    queryFn: fetchHoles,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
