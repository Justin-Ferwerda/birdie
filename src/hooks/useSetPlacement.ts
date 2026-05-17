import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Place } from '../types/database';

export interface SetPlacementArgs {
  tournament_id: string;
  minigame_id: string;
  place: Place;
  /** null = clear the placement at this slot, no replacement. */
  player_number: number | null;
  recorded_by_player_number?: number;
}

/** Assigns (or clears) a place in a minigame. To honor both unique
 *  constraints — one player per (game, place) and one place per
 *  (game, player) — we delete two possible conflicting rows before the
 *  insert. Activity events fire from M4. */
async function setPlacement(args: SetPlacementArgs) {
  const { tournament_id, minigame_id, place, player_number } = args;

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
