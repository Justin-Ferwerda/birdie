/** Color + shape helpers for raw stroke counts vs hole par.
 *
 * Follows golf convention: a circle around the score = under par,
 * a square = over par, no shape = par. */

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

/** Tailwind classes for a score cell. Shape + color, intended to fully
 * override the base shape — pair with no rounded-* on the cell itself. */
export function cellClasses(category: ScoreCategory): string {
  switch (category) {
    case 'ace':
      return 'rounded-full border-2 border-gold-500 bg-gold-500 text-slate-950 font-bold';
    case 'eagle':
      return 'rounded-full border-2 border-gold-500 bg-gold-500/20 text-gold-300 font-semibold';
    case 'birdie':
      return 'rounded-full border-2 border-gold-500 text-gold-400 font-semibold';
    case 'par':
      return 'text-slate-100';
    case 'bogey':
      return 'rounded-none border-2 border-amber-500 text-amber-300';
    case 'double_bogey':
      return 'rounded-none border-2 border-orange-500 text-orange-300 font-medium';
    case 'worse':
      return 'rounded-none border-2 border-rose-500 text-rose-300 font-medium';
  }
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}
