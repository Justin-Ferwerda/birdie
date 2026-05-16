import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Person } from '../types/database';

export interface SetupPlayer {
  name: string;
  card_number: 1 | 2 | 3;
  is_scorekeeper: boolean;
  /** If the user picked an existing person from the autocomplete, their id. */
  existing_person_id?: string;
}

interface StartTournamentArgs {
  tournament_id: string;
  players: SetupPlayer[];
}

async function startTournament({ tournament_id, players }: StartTournamentArgs) {
  if (players.length !== 12) {
    throw new Error(`Expected 12 players, got ${players.length}`);
  }

  // 1. Resolve every player to a person_id, creating new rows as needed.
  const namesNeedingCreation = players
    .filter((p) => !p.existing_person_id)
    .map((p) => p.name.trim());

  let createdPeople: Person[] = [];
  if (namesNeedingCreation.length > 0) {
    const { data, error } = await supabase
      .from('people')
      .insert(namesNeedingCreation.map((display_name) => ({ display_name })))
      .select();
    if (error) throw error;
    createdPeople = (data ?? []) as Person[];
  }

  // Map each player slot to its person_id (existing or newly created).
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

  // 2. Insert all 12 tournament_players in one batch.
  const { error: tpError } = await supabase.from('tournament_players').insert(playerRows);
  if (tpError) throw tpError;

  // 3. Mark setup complete.
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
