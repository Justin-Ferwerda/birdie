import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface EnterScoreArgs {
  tournament_id: string;
  player_number: number;
  hole_id: string;
  strokes: number;
  par_snapshot: number;
  entered_by_player_number: number;
}

async function enterScore(args: EnterScoreArgs) {
  // Upsert by (tournament_id, player_number, hole_id) so a re-tap on a
  // cell overwrites cleanly instead of erroring on the unique constraint.
  const { error } = await supabase
    .from('scores')
    .upsert(args, { onConflict: 'tournament_id,player_number,hole_id' });
  if (error) throw error;
}

export function useEnterScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enterScore,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['scores', vars.tournament_id] });
    },
  });
}
