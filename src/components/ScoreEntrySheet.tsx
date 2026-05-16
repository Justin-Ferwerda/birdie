import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useEnterScore } from '../hooks/useEnterScore';
import Avatar from './Avatar';
import type { Hole } from '../types/database';
import type { TournamentPlayerWithPerson } from '../hooks/useTournamentPlayers';

interface ScoreEntrySheetProps {
  tournament_id: string;
  player: TournamentPlayerWithPerson;
  hole: Hole;
  currentStrokes: number | null;
  enteredByPlayerNumber: number;
  onClose: () => void;
}

export default function ScoreEntrySheet({
  tournament_id,
  player,
  hole,
  currentStrokes,
  enteredByPlayerNumber,
  onClose,
}: ScoreEntrySheetProps) {
  const [strokes, setStrokes] = useState<number>(currentStrokes ?? hole.par);
  const enterScore = useEnterScore();

  // Lock background scroll while the sheet is open.
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

  const handleSave = async () => {
    try {
      await enterScore.mutateAsync({
        tournament_id,
        player_number: player.player_number,
        hole_id: hole.id,
        strokes,
        par_snapshot: hole.par,
        entered_by_player_number: enteredByPlayerNumber,
      });
      toast.success(`Saved ${player.display_name}: ${strokes} on H${hole.hole_number}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save: ${msg}`);
    }
  };

  const toPar = strokes - hole.par;
  const toParLabel =
    toPar === 0 ? 'par' : toPar > 0 ? `+${toPar}` : `${toPar}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 -z-10 bg-slate-950/70 backdrop-blur"
      />

      <div className="mx-auto w-full max-w-md rounded-t-2xl border-x border-t border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-3">
          <Avatar
            avatarId={player.person?.avatar_id}
            displayName={player.display_name}
            size={48}
          />
          <div className="flex-1 min-w-0">
            <div className="truncate text-base font-semibold">{player.display_name}</div>
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Hole {hole.hole_number} · Par {hole.par}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="rounded-md bg-slate-800 px-3 py-1 text-sm"
          >
            Cancel
          </button>
        </div>

        <div className="mb-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
          {hole.pin_placement && <span>Pin {hole.pin_placement}</span>}
          {hole.distance_ft && <span>{hole.distance_ft} ft</span>}
          {hole.notes && <span className="text-slate-500">{hole.notes}</span>}
        </div>

        <div className="mb-5 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setStrokes((s) => Math.max(1, s - 1))}
            disabled={strokes <= 1}
            className="h-14 w-14 rounded-full bg-slate-800 text-2xl font-semibold text-slate-100 disabled:opacity-40"
          >
            −
          </button>
          <div className="flex w-28 flex-col items-center">
            <div className="text-5xl font-bold tabular-nums">{strokes}</div>
            <div className="text-xs uppercase tracking-wider text-slate-400">
              {toParLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStrokes((s) => Math.min(15, s + 1))}
            disabled={strokes >= 15}
            className="h-14 w-14 rounded-full bg-slate-800 text-2xl font-semibold text-slate-100 disabled:opacity-40"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={enterScore.isPending}
          className="w-full rounded-xl bg-gold-500 px-4 py-3 text-base font-semibold text-slate-950 transition-colors disabled:opacity-60"
        >
          {enterScore.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
