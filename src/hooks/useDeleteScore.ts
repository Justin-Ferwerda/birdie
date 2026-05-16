import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface DeleteScoreArgs {
  tournament_id: string;
  player_number: number;
  hole_id: string;
}

/** Removes a score that was entered on the wrong hole (or with the wrong
 *  player). Also drops the primary rule activation for the (player, hole)
 *  and any score-quality / rule_activation events. Pre-hole declarations
 *  by *other* players (where this player is just a partner / sabotage
 *  target) survive — they belong to someone else. */
async function deleteScore({ tournament_id, player_number, hole_id }: DeleteScoreArgs) {
  // 1. Score-quality and rule_activation events for this player+hole.
  const { error: eErr } = await supabase
    .from('activity_events')
    .delete()
    .eq('tournament_id', tournament_id)
    .eq('player_number', player_number)
    .eq('hole_id', hole_id)
    .in('event_type', [
      'ace',
      'eagle',
      'birdie',
      'double_bogey_or_worse',
      'rule_activation',
    ]);
  if (eErr) throw eErr;

  // 2. Primary rule activation owned by this player on this hole.
  const { error: aErr } = await supabase
    .from('rule_activations')
    .delete()
    .eq('tournament_id', tournament_id)
    .eq('primary_player_number', player_number)
    .eq('hole_id', hole_id);
  if (aErr) throw aErr;

  // 3. The score itself.
  const { error: sErr } = await supabase
    .from('scores')
    .delete()
    .eq('tournament_id', tournament_id)
    .eq('player_number', player_number)
    .eq('hole_id', hole_id);
  if (sErr) throw sErr;
}

export function useDeleteScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteScore,
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['scores', vars.tournament_id] });
      queryClient.invalidateQueries({ queryKey: ['rule-activations', vars.tournament_id] });
      queryClient.invalidateQueries({ queryKey: ['activity-events', vars.tournament_id] });
    },
  });
}
