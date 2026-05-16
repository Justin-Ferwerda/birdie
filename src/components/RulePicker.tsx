import { RULES, type EligibilityContext, type Rule, type RuleShape } from '../config/rules';

/** Shapes pickable from inside the score entry sheet.
 * cross_card_target and pre_declared have their own Declare/Activate flow
 * on the Scorecard — they don't belong in the per-cell entry sheet. */
const SCORE_ENTRY_SHAPES: ReadonlySet<RuleShape> = new Set([
  'self_modifier',
  'conditional_modifier',
  'multi_player',
  'whole_card',
  'tournament_event',
  'flag_only',
]);

interface RulePickerProps {
  ctx: EligibilityContext;
  selectedKey: string | null;
  onSelect: (rule: Rule | null) => void;
  /** Override the default shape filter (used by the Declare sheet). */
  shapes?: ReadonlySet<RuleShape>;
}

export default function RulePicker({
  ctx,
  selectedKey,
  onSelect,
  shapes = SCORE_ENTRY_SHAPES,
}: RulePickerProps) {
  const available = RULES.filter((r) => shapes.has(r.shape) && r.eligible(ctx));

  if (available.length === 0) {
    return (
      <p className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500">
        No rules available for this hole right now.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {available.map((r) => {
        const isSelected = r.key === selectedKey;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onSelect(isSelected ? null : r)}
            className={[
              'flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-colors',
              isSelected
                ? 'border-gold-500 bg-gold-500/10'
                : 'border-slate-800 bg-slate-900/60 active:bg-slate-800',
            ].join(' ')}
          >
            <div className="flex w-full items-center gap-1.5">
              <span aria-hidden className="text-base leading-none">
                {r.emoji}
              </span>
              <span className="flex-1 truncate text-xs font-semibold text-slate-100">
                {r.displayName}
              </span>
              {r.requiresPhoto && (
                <span
                  title="Photo required (Phase 13 wires uploads)"
                  className="text-[9px] uppercase tracking-wider text-slate-500"
                >
                  📷
                </span>
              )}
            </div>
            <p className="text-[11px] leading-snug text-slate-400">
              {r.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
