import { useRuleAnimationStore } from '../lib/ruleAnimations';

/** Mounted at App root once. Renders the currently active rule animation
 *  as a fullscreen, non-interactive overlay. The store auto-clears after
 *  the animation's duration. */
export default function RuleAnimationOverlay() {
  const current = useRuleAnimationStore((s) => s.current);
  if (!current) return null;

  switch (current.kind) {
    case 'full_moon':
      return <FullMoon />;
    case 'marshmallow':
      return <Marshmallow />;
    case 'shotgun':
      return <Shotgun fastestName={current.payload?.fastest_name} />;
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
