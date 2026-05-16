import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Person } from '../types/database';

export interface SetupPlayer {
  name: string;
  card_number: 1 | 2 | 3;
  is_scorekeeper: boolean;
  avatar_id: string | null;
  /** If the user picked an existing person from the autocomplete, their id. */
  existing_person_id?: string;
}

interface StartTournamentArgs {
  tournament_id: string;
  players: SetupPlayer[];
}

async function startTournament({ tournament_id, players }: StartTournamentArgs) {
  // 1. Insert new people, carrying their avatar pick.
  const newPlayers = players.filter((p) => !p.existing_person_id);
  let createdPeople: Person[] = [];
  if (newPlayers.length > 0) {
    const { data, error } = await supabase
      .from('people')
      .insert(
        newPlayers.map((p) => ({
          display_name: p.name.trim(),
          avatar_id: p.avatar_id,
        })),
      )
      .select();
    if (error) throw error;
    createdPeople = (data ?? []) as Person[];
  }

  // 2. For existing people whose avatar changed, update.
  const existingWithAvatar = players.filter(
    (p) => p.existing_person_id && p.avatar_id != null,
  );
  for (const p of existingWithAvatar) {
    const { error } = await supabase
      .from('people')
      .update({ avatar_id: p.avatar_id })
      .eq('id', p.existing_person_id!);
    if (error) throw error;
  }

  // 3. Resolve every slot to its person_id and build the player rows.
  const newPeopleByName = new Map(createdPeople.map((p) => [p.display_name, p.id]));
  const playerRows = players.map((p, idx) => {
    const trimmed = p.name.trim();
    const person_id = p.existing_person_id ?? newPeopleByName.get(trimmed);
    if (!person_id) {
      throw new Error(`Could not resolve person_id for player ${idx + 1} (${trimmed})`);
    }
    return {
      tournament_id,
      player_number: idx + 1,
      person_id,
      display_name: trimmed,
      card_number: p.card_number,
      is_scorekeeper: p.is_scorekeeper,
    };
  });

  // 4. Insert all tournament_players in one batch.
  const { error: tpError } = await supabase.from('tournament_players').insert(playerRows);
  if (tpError) throw tpError;

  // 5. Flip the gate.
  const { error: tError } = await supabase
    .from('tournaments')
    .update({ setup_complete: true })
    .eq('id', tournament_id);
  if (tError) throw tError;
}

export function useStartTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startTournament,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-tournament'] });
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['tournament-players'] });
    },
  });
}
