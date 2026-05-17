import { useMemo, useState } from 'react';
import { useMinigames } from '../hooks/useMinigames';
import { useMinigamePlacements } from '../hooks/useMinigamePlacements';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useActiveTournament } from '../hooks/useActiveTournament';
import Avatar from './Avatar';
import PlacementModal from './PlacementModal';
import type { Minigame, MinigamePlacement, Place } from '../types/database';
import type { TournamentPlayerWithPerson } from '../hooks/useTournamentPlayers';

const PLACE_META: Record<Place, { medal: string; label: string; points: number }> = {
  1: { medal: '🥇', label: '1st', points: 3 },
  2: { medal: '🥈', label: '2nd', points: 2 },
  3: { medal: '🥉', label: '3rd', points: 1 },
};

export default function MinigamesList() {
  const tournament = useActiveTournament();
  const minigamesQ = useMinigames();
  const placementsQ = useMinigamePlacements();
  const playersQ = useTournamentPlayers();
  const [editing, setEditing] = useState<{ minigame: Minigame; place: Place } | null>(
    null,
  );

  const placementsByGame = useMemo(() => {
    const map = new Map<string, Map<Place, MinigamePlacement>>();
    (placementsQ.data ?? []).forEach((p) => {
      const inner = map.get(p.minigame_id) ?? new Map<Place, MinigamePlacement>();
      inner.set(p.place as Place, p);
      map.set(p.minigame_id, inner);
    });
    return map;
  }, [placementsQ.data]);

  const playerByNumber = useMemo(() => {
    const m = new Map<number, TournamentPlayerWithPerson>();
    (playersQ.data ?? []).forEach((p) => m.set(p.player_number, p));
    return m;
  }, [playersQ.data]);

  if (minigamesQ.isLoading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  }
  if (minigamesQ.error) {
    return (
      <p className="rounded-md border border-rose-800 bg-rose-900/30 p-3 text-xs text-rose-200">
        Could not load minigames. {(minigamesQ.error as Error).message}
      </p>
    );
  }
  if (!minigamesQ.data || minigamesQ.data.length === 0) {
    return (
      <p className="rounded-md border border-amber-700 bg-amber-900/30 p-3 text-xs text-amber-200">
        No minigames seeded for this tournament. Run{' '}
        <code className="rounded bg-slate-800 px-1 text-xs">009_create_minigames.sql</code>{' '}
        in the SQL Editor.
      </p>
    );
  }

  return (
    <>
      <ol className="flex flex-col gap-2">
        {minigamesQ.data.map((g) => (
          <MinigameCard
            key={g.id}
            game={g}
            placements={placementsByGame.get(g.id)}
            playerByNumber={playerByNumber}
            onTap={(place) => setEditing({ minigame: g, place })}
          />
        ))}
      </ol>

      {editing && tournament.data && (
        <PlacementModal
          tournament_id={tournament.data.id}
          minigame={editing.minigame}
          place={editing.place}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

interface MinigameCardProps {
  game: Minigame;
  placements: Map<Place, MinigamePlacement> | undefined;
  playerByNumber: Map<number, TournamentPlayerWithPerson>;
  onTap: (place: Place) => void;
}

function MinigameCard({ game, placements, playerByNumber, onTap }: MinigameCardProps) {
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2 text-sm font-semibold text-slate-100">
        {game.display_name}
      </div>
      <ul className="flex flex-col gap-1.5">
        {([1, 2, 3] as Place[]).map((place) => {
          const meta = PLACE_META[place];
          const placement = placements?.get(place);
          const player = placement
            ? playerByNumber.get(placement.player_number)
            : null;
          return (
            <li key={place}>
              <button
                type="button"
                onClick={() => onTap(place)}
                className="flex w-full items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-left transition-colors active:bg-slate-900"
              >
                <span aria-hidden className="text-base leading-none">
                  {meta.medal}
                </span>
                <span className="w-12 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {meta.label}{' '}
                  <span className="font-normal text-gold-500">+{meta.points}</span>
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {player ? (
                    <>
                      <Avatar
                        avatarId={player.person?.avatar_id}
                        displayName={player.display_name}
                        size={24}
                      />
                      <span className="truncate text-sm text-slate-100">
                        {player.display_name}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs italic text-slate-500">
                      Tap to assign
                    </span>
                  )}
                </div>
                {player && (
                  <span aria-hidden className="text-xs text-slate-500">
                    ✏️
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
