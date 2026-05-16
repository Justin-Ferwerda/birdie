/** Tiny store for fullscreen rule animation overlays (Full Moon rise,
 *  Marshmallow bounce, Shotgun beer-clink). RealtimeListener calls
 *  triggerRuleAnimation when the matching event arrives. */

import { create } from 'zustand';

export type RuleAnimationKind = 'full_moon' | 'marshmallow' | 'shotgun';

interface RuleAnimationPayload {
  fastest_name?: string;
}

interface ActiveRuleAnimation {
  id: number;
  kind: RuleAnimationKind;
  payload?: RuleAnimationPayload;
}

interface Store {
  current: ActiveRuleAnimation | null;
  trigger: (kind: RuleAnimationKind, payload?: RuleAnimationPayload) => void;
  clear: (id: number) => void;
}

const DURATION_MS: Record<RuleAnimationKind, number> = {
  full_moon: 1500,
  marshmallow: 1200,
  shotgun: 1800,
};

let nextId = 1;

export const useRuleAnimationStore = create<Store>((set, get) => ({
  current: null,
  trigger: (kind, payload) => {
    const id = nextId++;
    set({ current: { id, kind, payload } });
    setTimeout(() => {
      // Only clear if a newer animation hasn't superseded us.
      if (get().current?.id === id) set({ current: null });
    }, DURATION_MS[kind]);
  },
  clear: (id) => {
    if (get().current?.id === id) set({ current: null });
  },
}));

export function triggerRuleAnimation(
  kind: RuleAnimationKind,
  payload?: RuleAnimationPayload,
) {
  useRuleAnimationStore.getState().trigger(kind, payload);
}
