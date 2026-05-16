/** Confetti + pulse-cell celebration helpers.
 *
 * Called from RealtimeListener when ace/eagle/birdie events arrive.
 * The pulse state lives in a shared Zustand store so cells can subscribe
 * to their own (player, hole) key and pulse for ~1.2s. */

import { create } from 'zustand';
import confetti from 'canvas-confetti';

export type CelebrationCategory = 'ace' | 'eagle' | 'birdie';

const PULSE_MS: Record<CelebrationCategory, number> = {
  ace: 1600,
  eagle: 1200,
  birdie: 900,
};

interface CelebrationStore {
  pulses: Record<string, CelebrationCategory>;
  pulse: (key: string, category: CelebrationCategory) => void;
  clear: (key: string) => void;
}

const useCelebrationStore = create<CelebrationStore>((set) => ({
  pulses: {},
  pulse: (key, category) =>
    set((state) => ({ pulses: { ...state.pulses, [key]: category } })),
  clear: (key) =>
    set((state) => {
      if (!(key in state.pulses)) return state;
      const next = { ...state.pulses };
      delete next[key];
      return { pulses: next };
    }),
}));

/** Subscribe to a single (player, hole) cell. Returns the active category
 *  or undefined when not pulsing. */
export function useCellPulse(key: string): CelebrationCategory | undefined {
  return useCelebrationStore((s) => s.pulses[key]);
}

/** Trigger a celebration for a cell. Schedules confetti + a pulse, then
 *  auto-clears the pulse after the category's duration. */
export function celebrate(key: string, category: CelebrationCategory) {
  useCelebrationStore.getState().pulse(key, category);
  setTimeout(
    () => useCelebrationStore.getState().clear(key),
    PULSE_MS[category],
  );
  fireConfetti(category);
}

const GOLD = ['#d4af37', '#a3851f', '#fbeec0', '#e7c84a'];
const EAGLE = ['#d4af37', '#fbeec0', '#d946ef', '#a21caf'];
const ACE = ['#d4af37', '#fbeec0', '#facc15', '#fde047', '#ffffff'];

function fireConfetti(category: CelebrationCategory) {
  switch (category) {
    case 'birdie':
      confetti({
        particleCount: 60,
        spread: 55,
        startVelocity: 35,
        origin: { y: 0.3 },
        colors: GOLD,
        scalar: 0.9,
        disableForReducedMotion: true,
      });
      return;

    case 'eagle':
      confetti({
        particleCount: 150,
        spread: 90,
        startVelocity: 45,
        origin: { y: 0.35 },
        colors: EAGLE,
        scalar: 1.1,
        disableForReducedMotion: true,
      });
      return;

    case 'ace':
      // Side cannons + center burst. Spec: "screen-wide confetti."
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.4, x: 0.5 },
        colors: ACE,
        scalar: 1.2,
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 70,
        startVelocity: 55,
        origin: { x: 0, y: 0.7 },
        colors: ACE,
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 70,
        startVelocity: 55,
        origin: { x: 1, y: 0.7 },
        colors: ACE,
        disableForReducedMotion: true,
      });
      return;
  }
}
