import { useEffect } from 'react';
import { AVATARS } from '../lib/avatars';

interface AvatarPickerProps {
  /** Currently selected avatar_id for the player being edited. */
  selected: string | null;
  /** avatar_ids already claimed by *other* players — greyed out. */
  taken: Set<string>;
  onPick: (avatarId: string | null) => void;
  onClose: () => void;
}

export default function AvatarPicker({
  selected,
  taken,
  onPick,
  onClose,
}: AvatarPickerProps) {
  // Lock the body scroll while the sheet is open and close on Escape.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 -z-10"
      />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 overflow-y-auto p-5">
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Pick an avatar</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-800 px-3 py-1 text-sm text-slate-200"
          >
            Cancel
          </button>
        </header>

        {AVATARS.length === 0 && (
          <p className="rounded-lg border border-amber-700 bg-amber-900/30 p-3 text-sm text-amber-200">
            No avatars found. Drop images into{' '}
            <code className="rounded bg-slate-800 px-1 py-0.5 text-xs">
              src/assets/avatars/
            </code>{' '}
            (PNG, JPG, WEBP, or SVG) and reload.
          </p>
        )}

        {selected && (
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onClose();
            }}
            className="self-start rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-300"
          >
            Clear avatar
          </button>
        )}

        <div className="grid grid-cols-3 gap-3">
          {AVATARS.map((a) => {
            const isSelected = a.id === selected;
            const isTakenByOther = taken.has(a.id) && a.id !== selected;
            return (
              <button
                key={a.id}
                type="button"
                disabled={isTakenByOther}
                onClick={() => {
                  onPick(a.id);
                  onClose();
                }}
                className={[
                  'group flex flex-col items-center gap-1 rounded-xl border p-2 transition-colors',
                  isSelected
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-slate-800 bg-slate-900/60 active:bg-slate-800',
                  isTakenByOther && 'opacity-30',
                ].join(' ')}
              >
                <img
                  src={a.url}
                  alt={a.id}
                  className="aspect-square w-full rounded-full object-cover"
                />
                <span className="line-clamp-1 text-[10px] uppercase tracking-wider text-slate-400">
                  {a.id}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
