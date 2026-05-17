import { useRuleAnimationStore } from '../lib/ruleAnimations';

/** Mounted at App root once. Renders the currently active rule animation
 *  as a fullscreen, non-interactive overlay. The store auto-clears after
 *  the animation's duration. */
export default function RuleAnimationOverlay() {
  const current = useRuleAnimationStore((s) => s.current);
  const clear = useRuleAnimationStore((s) => s.clear);
  if (!current) return null;

  switch (current.kind) {
    case 'full_moon':
      return <FullMoon />;
    case 'marshmallow':
      return <Marshmallow />;
    case 'shotgun':
      return <Shotgun fastestName={current.payload?.fastest_name} />;
    case 'minigame_champion':
      return (
        <MinigameChampion
          name={current.payload?.champion_name}
          onDismiss={() => clear(current.id)}
        />
      );
  }
}

function FullMoon() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
      <div
        className="animate-rule-fullmoon absolute top-0 left-0 text-7xl"
        aria-hidden
      >
        🌝
      </div>
    </div>
  );
}

function Marshmallow() {
  // 6 sprites staggered across the width.
  const sprites = [0, 1, 2, 3, 4, 5];
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
      {sprites.map((i) => {
        const leftPct = 10 + i * 14;
        const delay = (i % 3) * 80;
        return (
          <div
            key={i}
            aria-hidden
            className="animate-rule-marshmallow absolute text-5xl"
            style={{
              top: 0,
              left: `${leftPct}vw`,
              ['--rule-mm-delay' as string]: `${delay}ms`,
            }}
          >
            🟪
          </div>
        );
      })}
    </div>
  );
}

function MinigameChampion({
  name,
  onDismiss,
}: {
  name?: string;
  onDismiss: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss champion celebration"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-slate-950/85 backdrop-blur"
    >
      <div className="animate-rule-champion-trophy text-9xl" aria-hidden>
        🏆
      </div>
      <div className="animate-rule-champion-name flex flex-col items-center gap-1 px-4">
        <div className="text-xs font-bold uppercase tracking-widest text-gold-400">
          Minigames Champion
        </div>
        <div className="text-center text-3xl font-black text-slate-50">
          {name ?? 'Champion'}
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        Tap to dismiss
      </div>
    </button>
  );
}

function Shotgun({ fastestName }: { fastestName?: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl">
        <span className="animate-rule-shotgun-mug-left inline-block" aria-hidden>
          🍺
        </span>
        <span className="animate-rule-shotgun-mug-right inline-block" aria-hidden>
          🍺
        </span>
      </div>
      {fastestName && (
        <div className="animate-rule-shotgun-name absolute bottom-[30%] left-1/2 -translate-x-1/2 rounded-xl bg-amber-500 px-4 py-2 text-base font-black uppercase tracking-wider text-slate-950 shadow-lg">
          Fastest: {fastestName}
        </div>
      )}
    </div>
  );
}
