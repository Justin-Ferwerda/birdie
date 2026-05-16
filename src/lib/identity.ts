// Per-phone identity. After Setup, each phone picks "I am player N" once
// and we remember it forever. No auth, no server state. If someone wipes
// their browser data or switches devices, they re-pick.
//
// Keyed by tournament_id so a fresh tournament (e.g. 2027) prompts again.

const KEY = 'birdie.myPlayerNumber';

interface Stored {
  tournament_id: string;
  player_number: number;
}

export function getMyPlayerNumber(tournament_id: string): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.tournament_id !== tournament_id) return null;
    return parsed.player_number;
  } catch {
    return null;
  }
}

export function setMyPlayerNumber(tournament_id: string, player_number: number) {
  const value: Stored = { tournament_id, player_number };
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function clearMyPlayerNumber() {
  localStorage.removeItem(KEY);
}
