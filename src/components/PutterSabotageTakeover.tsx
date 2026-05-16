import { useEffect, useState } from 'react';

interface PutterSabotageTakeoverProps {
  primaryName: string;
  holeNumber: number | null;
  onDismiss: () => void;
}

/** Full-screen red takeover for the player who just got sabotaged. */
export default function PutterSabotageTakeover({
  primaryName,
  holeNumber,
  onDismiss,
}: PutterSabotageTakeoverProps) {
  // 2-second cooldown before the dismiss button is tappable.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }
    const t = setTimeout(() => setArmed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-rose-700 p-6 text-center text-white">
      <div className="text-6xl">🎯</div>
      <div className="text-4xl font-black tracking-tight">PUTTER ONLY</div>
      <div className="max-w-xs text-sm leading-relaxed">
        {primaryName} sabotaged you{holeNumber != null && ` on hole ${holeNumber}`}.
        Putter only.
      </div>
      <button
        type="button"
        onClick={onDismiss}
        disabled={!armed}
        className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-rose-700 disabled:opacity-50"
      >
        {armed ? 'I accept my fate' : 'Hold on…'}
      </button>
    </div>
  );
}
