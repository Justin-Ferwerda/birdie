// Per-phone identity. After Setup, each phone picks "I am player N" once
// and we remember it forever. No auth, no server state. If someone wipes
// their browser data or switches devices, they re-pick.
//
// Keyed by tournament_id so a fresh tournament (e.g. 2027) prompts again.
//
// player_number is the *active* identity (null after "Switch player").
// last_selected sticks around past clear so the picker can pre-highlight
// the row you were just on.

const KEY = 'birdie.myPlayerNumber';

interface Stored {
  tournament_id: string;
  player_number: number | null;
  last_selected: number | null;
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

function write(s: Stored) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function getMyPlayerNumber(tournament_id: string): number | null {
  const s = read();
  if (!s || s.tournament_id !== tournament_id) return null;
  return s.player_number;
}

export function getLastSelected(tournament_id: string): number | null {
  const s = read();
  if (!s || s.tournament_id !== tournament_id) return null;
  return s.last_selected;
}

export function setMyPlayerNumber(tournament_id: string, player_number: number) {
  write({ tournament_id, player_number, last_selected: player_number });
}

export function clearMyPlayerNumber() {
  const s = read();
  if (!s) return;
  write({ ...s, player_number: null });
}
