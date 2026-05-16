/** Color + label helpers for raw stroke counts vs hole par. */

export type ScoreCategory =
  | 'ace'
  | 'eagle'
  | 'birdie'
  | 'par'
  | 'bogey'
  | 'double_bogey'
  | 'worse';

export function categorize(strokes: number, par: number): ScoreCategory {
  if (strokes === 1) return 'ace';
  const diff = strokes - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  if (diff === 2) return 'double_bogey';
  return 'worse';
}

/** Tailwind classes for a score cell, by category. */
export function cellClasses(category: ScoreCategory): string {
  switch (category) {
    case 'ace':
      return 'bg-gold-500 text-slate-950 font-bold';
    case 'eagle':
      return 'bg-fuchsia-500 text-slate-950 font-semibold';
    case 'birdie':
      return 'bg-gold-500/30 text-gold-400 font-semibold';
    case 'par':
      return 'text-slate-100';
    case 'bogey':
      return 'text-amber-400';
    case 'double_bogey':
      return 'text-orange-400 font-medium';
    case 'worse':
      return 'text-rose-400 font-medium';
  }
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}
