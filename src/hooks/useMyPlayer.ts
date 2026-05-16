import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import {
  clearMyPlayerNumber,
  getMyPlayerNumber,
  setMyPlayerNumber,
} from '../lib/identity';
import { useActiveTournament } from './useActiveTournament';

// Shared store so every useMyPlayer() consumer sees the same value.
// Without this, App / IdentityPicker / Home each held their own useState
// and a setPlayer call in one didn't re-render the others.
interface IdentityStore {
  playerNumber: number | null;
  hydratedForTournament: string | null;
  hydrate: (tournament_id: string) => void;
  set: (tournament_id: string, n: number) => void;
  clear: () => void;
}

const useIdentityStore = create<IdentityStore>((set) => ({
  playerNumber: null,
  hydratedForTournament: null,
  hydrate: (tournament_id) => {
    set({
      playerNumber: getMyPlayerNumber(tournament_id),
      hydratedForTournament: tournament_id,
    });
  },
  set: (tournament_id, n) => {
    setMyPlayerNumber(tournament_id, n);
    set({ playerNumber: n, hydratedForTournament: tournament_id });
  },
  clear: () => {
    clearMyPlayerNumber();
    set({ playerNumber: null });
  },
}));

export function useMyPlayer() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;

  const playerNumber = useIdentityStore((s) => s.playerNumber);
  const hydratedFor = useIdentityStore((s) => s.hydratedForTournament);
  const hydrate = useIdentityStore((s) => s.hydrate);
  const setRaw = useIdentityStore((s) => s.set);
  const clearRaw = useIdentityStore((s) => s.clear);

  useEffect(() => {
    if (tournament_id && hydratedFor !== tournament_id) {
      hydrate(tournament_id);
    }
  }, [tournament_id, hydratedFor, hydrate]);

  const setPlayer = useCallback(
    (n: number) => {
      if (tournament_id) setRaw(tournament_id, n);
    },
    [tournament_id, setRaw],
  );

  return {
    playerNumber,
    setPlayer,
    clearPlayer: clearRaw,
    isReady: !!tournament_id,
  };
}
