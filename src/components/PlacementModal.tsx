import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Avatar from './Avatar';
import { useSetPlacement } from '../hooks/useSetPlacement';
import { useMinigamePlacements } from '../hooks/useMinigamePlacements';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useMyPlayer } from '../hooks/useMyPlayer';
import type { Minigame, Place } from '../types/database';

const PLACE_META: Record<Place, { medal: string; label: string; points: number }> = {
  1: { medal: '🥇', label: '1st Place', points: 3 },
  2: { medal: '🥈', label: '2nd Place', points: 2 },
  3: { medal: '🥉', label: '3rd Place', points: 1 },
};

interface PlacementModalProps {
  tournament_id: string;
  minigame: Minigame;
  place: Place;
  onClose: () => void;
}

export default function PlacementModal({
  tournament_id,
  minigame,
  place,
  onClose,
}: PlacementModalProps) {
  const players = useTournamentPlayers();
  const placements = useMinigamePlacements();
  const { playerNumber: myPlayerNumber } = useMyPlayer();
  const setPlacement = useSetPlacement();

  // What does each player hold in *this* minigame?
  const placeByPlayerInGame = useMemo(() => {
    const m = new Map<number, Place>();
    (placements.data ?? [])
      .filter((p) => p.minigame_id === minigame.id)
      .forEach((p) => m.set(p.player_number, p.place as Place));
    return m;
  }, [placements.data, minigame.id]);

  const currentAtThisPlace = useMemo(
    () =>
      (placements.data ?? []).find(
        (p) => p.minigame_id === minigame.id && p.place === place,
      ),
    [placements.data, minigame.id, place],
  );

  const [selected, setSelected] = useState<number | null>(
    currentAtThisPlace?.player_number ?? null,
  );

  // Body scroll lock + esc-to-close.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const meta = PLACE_META[place];
  const canConfirm =
    selected != null && selected !== (currentAtThisPlace?.player_number ?? null);

  const handleConfirm = async () => {
    if (!canConfirm || selected == null) return;
    try {
      await setPlacement.mutateAsync({
        tournament_id,
        minigame_id: minigame.id,
        place,
        player_number: selected,
        recorded_by_player_number: myPlayerNumber ?? undefined,
      });
      const name =
        players.data?.find((p) => p.player_number === selected)?.display_name ??
        `Player ${selected}`;
      toast.success(`${meta.medal} ${name} — ${meta.label}, ${minigame.display_name}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save: ${msg}`);
    }
  };

  const handleClear = async () => {
    try {
      await setPlacement.mutateAsync({
        tournament_id,
        minigame_id: minigame.id,
        place,
        player_number: null,
        recorded_by_player_number: myPlayerNumber ?? undefined,
      });
      toast.success(`Cleared ${meta.label} for ${minigame.display_name}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not clear: ${msg}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 -z-10 bg-slate-950/70 backdrop-blur"
      />
      <div className="mx-auto flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl border-x border-t border-slate-800 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-slate-400">
              {minigame.display_name}
            </div>
            <div className="truncate text-lg font-semibold text-slate-100">
              {meta.medal} {meta.label}{' '}
              <span className="text-sm font-normal text-gold-500">
                +{meta.points}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-800 px-3 py-1 text-sm"
          >
            Cancel
          </button>
        </header>

        <ul className="flex flex-col gap-1.5">
          {(players.data ?? []).map((p) => {
            const heldPlace = placeByPlayerInGame.get(p.player_number);
            const heldHere = heldPlace === place;
            const heldElsewhere = heldPlace != null && !heldHere;
            const isSelected = selected === p.player_number;
            return (
              <li key={p.player_number}>
                <button
                  type="button"
                  disabled={heldElsewhere}
                  onClick={() => setSelected(p.player_number)}
                  className={[
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                    isSelected
                      ? 'border-gold-500 bg-gold-500/10'
                      : heldElsewhere
                        ? 'border-slate-800 bg-slate-900/40 opacity-50'
                        : 'border-slate-800 bg-slate-900/60 active:bg-slate-800',
                  ].join(' ')}
                >
                  <Avatar
                    avatarId={p.person?.avatar_id}
                    displayName={p.display_name}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-100">
                      {p.display_name}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      Card {p.card_number}
                      {heldHere && (
                        <span className="ml-1 text-gold-400">· current</span>
                      )}
                      {heldElsewhere && (
                        <span className="ml-1 text-slate-500">
                          · already took {PLACE_META[heldPlace as Place].label.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2">
          {currentAtThisPlace && (
            <button
              type="button"
              onClick={handleClear}
              disabled={setPlacement.isPending}
              className="self-center text-xs text-rose-400 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Clear placement
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm || setPlacement.isPending}
            className="w-full rounded-xl bg-gold-500 px-4 py-3 text-base font-semibold text-slate-950 transition-colors disabled:opacity-50"
          >
            {setPlacement.isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
