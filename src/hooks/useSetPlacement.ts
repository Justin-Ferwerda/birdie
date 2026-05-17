import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { recordPlacementEvents } from '../lib/events';
import type { Place } from '../types/database';

export interface SetPlacementArgs {
  tournament_id: string;
  minigame_id: string;
  minigame_display_name?: string;
  place: Place;
  /** null = clear the placement at this slot, no replacement. */
  player_number: number | null;
  player_display_name?: string;
  recorded_by_player_number?: number;
}

/** Assigns (or clears) a place in a minigame. Honors both unique
 *  constraints (one player per (game, place); one place per
 *  (game, player)) and keeps activity_events consistent with the
 *  placements. */
async function setPlacement(args: SetPlacementArgs) {
  const { tournament_id, minigame_id, place, player_number } = args;

  // Figure out which event slots need cleanup BEFORE we mutate placements.
  const placesToClear = new Set<number>([place]);
  if (player_number != null) {
    const { data, error } = await supabase
      .from('minigame_placements')
      .select('place')
      .eq('tournament_id', tournament_id)
      .eq('minigame_id', minigame_id)
      .eq('player_number', player_number)
      .maybeSingle();
    if (error) throw error;
    if (data?.place != null) placesToClear.add(data.place);
  }

  // Drop whatever's currently at this (game, place).
  const { error: dPlace } = await supabase
    .from('minigame_placements')
    .delete()
    .eq('tournament_id', tournament_id)
    .eq('minigame_id', minigame_id)
    .eq('place', place);
  if (dPlace) throw dPlace;

  // Drop anything this same player currently holds in this game (handles
  // "they took 2nd, now they're taking 1st").
  if (player_number != null) {
    const { error: dPlayer } = await supabase
      .from('minigame_placements')
      .delete()
      .eq('tournament_id', tournament_id)
      .eq('minigame_id', minigame_id)
      .eq('player_number', player_number);
    if (dPlayer) throw dPlayer;

    const { error: iErr } = await supabase.from('minigame_placements').insert({
      tournament_id,
      minigame_id,
      place,
      player_number,
      recorded_by_player_number: args.recorded_by_player_number ?? null,
    });
    if (iErr) throw iErr;
  }

  // Reconcile activity events for the slots we touched.
  await recordPlacementEvents({
    tournament_id,
    minigame_id,
    minigame_display_name: args.minigame_display_name,
    places_to_clear: Array.from(placesToClear),
    insert:
      player_number != null
        ? {
            place,
            player_number,
            player_display_name: args.player_display_name,
          }
        : undefined,
  });
}

export function useSetPlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: setPlacement,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ['minigame-placements', vars.tournament_id],
      });
      qc.invalidateQueries({
        queryKey: ['activity-events', vars.tournament_id],
      });
    },
  });
}
