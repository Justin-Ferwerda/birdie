import { describe, expect, it } from 'vitest';
import { computeTeeOrder, type MinimalScore } from './teeOrder';

const PLAYERS = [1, 2, 3, 4];
const HOLES = ['h1', 'h2', 'h3', 'h4'];

const score = (player_number: number, hole_id: string, strokes: number): MinimalScore => ({
  player_number,
  hole_id,
  strokes,
});

describe('computeTeeOrder', () => {
  it('hole 1: ascending player_number', () => {
    expect(
      computeTeeOrder({
        cardPlayerNumbers: PLAYERS,
        holeIds: HOLES,
        scores: [],
        holeIndex: 0,
      }),
    ).toEqual([1, 2, 3, 4]);
  });

  it('hole 2: lowest stroke on hole 1 tees first', () => {
    const scores = [
      score(1, 'h1', 4),
      score(2, 'h1', 3),
      score(3, 'h1', 5),
      score(4, 'h1', 6),
    ];
    expect(
      computeTeeOrder({
        cardPlayerNumbers: PLAYERS,
        holeIds: HOLES,
        scores,
        holeIndex: 1,
      }),
    ).toEqual([2, 1, 3, 4]);
  });

  it('ties on previous hole resolved by previous hole tee order', () => {
    // Hole 1 order: [1,2,3,4] (initial). All tie at 3 on h1.
    // Hole 2 order should equal hole 1 order.
    const scores = [
      score(1, 'h1', 3),
      score(2, 'h1', 3),
      score(3, 'h1', 3),
      score(4, 'h1', 3),
    ];
    expect(
      computeTeeOrder({
        cardPlayerNumbers: PLAYERS,
        holeIds: HOLES,
        scores,
        holeIndex: 1,
      }),
    ).toEqual([1, 2, 3, 4]);
  });

  it('partial tie: tied players go in prev-order, others by strokes', () => {
    // h1 order: [1,2,3,4]. h1 strokes: 1=3, 2=4, 3=3, 4=5.
    // h2 order: 1 and 3 tie at 3 (best). 1 went before 3 on h1 → 1 first,
    // then 3. Then 2 (next-lowest), then 4.
    const scores = [
      score(1, 'h1', 3),
      score(2, 'h1', 4),
      score(3, 'h1', 3),
      score(4, 'h1', 5),
    ];
    expect(
      computeTeeOrder({
        cardPlayerNumbers: PLAYERS,
        holeIds: HOLES,
        scores,
        holeIndex: 1,
      }),
    ).toEqual([1, 3, 2, 4]);
  });

  it('recursive: tie at h2 resolved by h1 order which itself broke a tie', () => {
    // h1 strokes: all tied at 3 → h1 order stays [1,2,3,4].
    // h2 strokes: 1=4, 2=3, 3=3, 4=4. 2 and 3 tie at 3 → both first,
    // sub-order by h1 order: 2 before 3. Then 1 and 4 tie at 4 → 1 before 4.
    const scores = [
      score(1, 'h1', 3), score(2, 'h1', 3), score(3, 'h1', 3), score(4, 'h1', 3),
      score(1, 'h2', 4), score(2, 'h2', 3), score(3, 'h2', 3), score(4, 'h2', 4),
    ];
    expect(
      computeTeeOrder({
        cardPlayerNumbers: PLAYERS,
        holeIds: HOLES,
        scores,
        holeIndex: 2,
      }),
    ).toEqual([2, 3, 1, 4]);
  });

  it('missing scores sort to the end and preserve prev order among themselves', () => {
    // h1: only players 1 and 3 scored. 1 had 4, 3 had 3.
    // For h2: 3 first (lower), 1 second. Players 2 and 4 (no h1 score)
    // sort to end in their previous order [2,4].
    const scores = [score(1, 'h1', 4), score(3, 'h1', 3)];
    expect(
      computeTeeOrder({
        cardPlayerNumbers: PLAYERS,
        holeIds: HOLES,
        scores,
        holeIndex: 1,
      }),
    ).toEqual([3, 1, 2, 4]);
  });
});
