import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface FireShotgunArgs {
  tournament_id: string;
  participants: number[];        // player_numbers
  fastest_player_number: number; // must be in participants
  fastest_display_name?: string;
}

/** Fires The Shotgun. For each participant, inserts a pending rule_activation
 *  with the appropriate delta (-1 for participants, -3 for fastest). The
 *  activation has hole_id=null and outcome.pending=true until consumed at
 *  the player's next Crockett hole score (see useEnterScore). Also flips
 *  tournaments.shotgun_fired and emits a single shotgun_event for the feed. */
async function fireShotgun(args: FireShotgunArgs) {
  const { tournament_id, participants, fastest_player_number } = args;

  if (!participants.includes(fastest_player_number)) {
    throw new Error('Fastest finisher must be a participant.');
  }

  // 1. Per-participant pending activations.
  const rows = participants.map((player_number) => ({
    tournament_id,
    rule_key: 'the_shotgun',
    primary_player_number: player_number,
    hole_id: null,
    card_number: null,
    outcome: {
      pending: true,
      is_fastest: player_number === fastest_player_number,
    },
    delta_applied: player_number === fastest_player_number ? -3 : -1,
  }));

  const { error: aErr } = await supabase.from('rule_activations').insert(rows);
  if (aErr) throw aErr;

  // 2. Flip the tournament flag.
  const { error: tErr } = await supabase
    .from('tournaments')
    .update({
      shotgun_fired: true,
      shotgun_fired_at: new Date().toISOString(),
    })
    .eq('id', tournament_id);
  if (tErr) throw tErr;

  // 3. One shotgun_event for the activity feed.
  const { error: eErr } = await supabase.from('activity_events').insert({
    tournament_id,
    event_type: 'shotgun_event',
    player_number: fastest_player_number,
    hole_id: null,
    payload: {
      participants,
      fastest_player_number,
      fastest_display_name: args.fastest_display_name,
    },
  });
  if (eErr) throw eErr;
}

export function useFireShotgun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fireShotgun,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['active-tournament'] });
      qc.invalidateQueries({ queryKey: ['rule-activations', vars.tournament_id] });
      qc.invalidateQueries({ queryKey: ['activity-events', vars.tournament_id] });
    },
  });
}
