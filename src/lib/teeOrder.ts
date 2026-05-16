/** Tee order for a card on a given hole.
 *
 * Standard golf rule: lowest score on the previous hole tees first on the
 * next hole. Ties revert to the previous hole's order recursively. Hole 1
 * uses an initial order (ascending player_number — stable and simple).
 *
 * "Score" here is raw strokes, ignoring rule_delta. Tee order is about
 * who scored the lowest stroke count on the ground, not who has the most
 * social-rule bonuses applied. */

export interface MinimalScore {
  player_number: number;
  hole_id: string;
  strokes: number;
}

interface ComputeArgs {
  /** Card player numbers in their starting (hole 1) order. Convention:
   *  ascending player_number within the card. */
  cardPlayerNumbers: number[];
  /** Holes on the course this card is playing, ordered by hole_number asc. */
  holeIds: string[];
  /** All scores for the card (any subset is fine). Other players' scores
   *  are ignored even if present. */
  scores: MinimalScore[];
  /** Zero-indexed: 0 = hole 1. */
  holeIndex: number;
}

/** Returns player_numbers in tee order for hole `holeIndex` (0-based). */
export function computeTeeOrder({
  cardPlayerNumbers,
  holeIds,
  scores,
  holeIndex,
}: ComputeArgs): number[] {
  // Hole 1: initial order by ascending player_number.
  if (holeIndex <= 0) {
    return [...cardPlayerNumbers].sort((a, b) => a - b);
  }

  const prevHoleId = holeIds[holeIndex - 1];
  const prevOrder = computeTeeOrder({
    cardPlayerNumbers,
    holeIds,
    scores,
    holeIndex: holeIndex - 1,
  });
  const prevRank = new Map(prevOrder.map((pn, i) => [pn, i]));

  // Score on the previous hole, per card player.
  const prevScore = new Map<number, number | null>();
  for (const pn of cardPlayerNumbers) {
    const s = scores.find(
      (x) => x.player_number === pn && x.hole_id === prevHoleId,
    );
    prevScore.set(pn, s ? s.strokes : null);
  }

  return [...cardPlayerNumbers].sort((a, b) => {
    const sa = prevScore.get(a);
    const sb = prevScore.get(b);
    // If either's prev score is missing, fall through to prev order — we
    // don't have enough info to rank by strokes.
    if (sa == null && sb == null) return (prevRank.get(a) ?? 0) - (prevRank.get(b) ?? 0);
    if (sa == null) return 1;
    if (sb == null) return -1;
    if (sa !== sb) return sa - sb;
    // Tied: previous order wins (recursive via prevRank, which itself was
    // built from prevOrder).
    return (prevRank.get(a) ?? 0) - (prevRank.get(b) ?? 0);
  });
}
