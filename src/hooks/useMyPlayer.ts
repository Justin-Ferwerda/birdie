import { useCallback, useEffect, useState } from 'react';
import { getMyPlayerNumber, setMyPlayerNumber } from '../lib/identity';
import { useActiveTournament } from './useActiveTournament';

export function useMyPlayer() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;
  const [playerNumber, setPlayerNumberState] = useState<number | null>(null);

  useEffect(() => {
    if (!tournament_id) return;
    setPlayerNumberState(getMyPlayerNumber(tournament_id));
  }, [tournament_id]);

  const setPlayer = useCallback(
    (n: number) => {
      if (!tournament_id) return;
      setMyPlayerNumber(tournament_id, n);
      setPlayerNumberState(n);
    },
    [tournament_id],
  );

  return { playerNumber, setPlayer, isReady: !!tournament_id };
}
