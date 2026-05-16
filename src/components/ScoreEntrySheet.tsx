import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useEnterScore } from '../hooks/useEnterScore';
import { useRuleActivations } from '../hooks/useRuleActivations';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import Avatar from './Avatar';
import RulePicker from './RulePicker';
import PartnerPicker from './PartnerPicker';
import type { Hole } from '../types/database';
import type { TournamentPlayerWithPerson } from '../hooks/useTournamentPlayers';
import { getRule, type EligibilityContext, type Rule, type RuleOutcome } from '../config/rules';
import { categorize, cellClasses, formatToPar } from '../lib/scoring';

interface ScoreEntrySheetProps {
  tournament_id: string;
  player: TournamentPlayerWithPerson;
  hole: Hole;
  currentStrokes: number | null;
  /** Rule already saved on this player's score for this hole, if any. */
  currentRuleKey: string | null;
  currentRuleOutcome: Record<string, unknown> | null;
  currentPartnerPlayerNumbers: number[] | null;
  /** Rule someone ELSE picked that names this player as a partner. */
  incomingPartnerRuleKey: string | null;
  incomingPartnerPrimaryName: string | null;
  enteredByPlayerNumber: number;
  onClose: () => void;
}

/** Conditional rules whose outcome is a binary success/fail the user picks. */
const SUCCESS_RULES = new Set([
  'the_marshmallow',
  'the_trust_fall',
  'let_the_record_show',
]);

const MULTI_PLAYER_NEEDS_PARTNER = new Set(['the_caddie_shack', 'going_steady']);

export default function ScoreEntrySheet({
  tournament_id,
  player,
  hole,
  currentStrokes,
  currentRuleKey,
  currentRuleOutcome,
  currentPartnerPlayerNumbers,
  incomingPartnerRuleKey,
  incomingPartnerPrimaryName,
  enteredByPlayerNumber,
  onClose,
}: ScoreEntrySheetProps) {
  const [strokes, setStrokes] = useState<number>(currentStrokes ?? hole.par);
  const [showRules, setShowRules] = useState<boolean>(!!currentRuleKey);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(
    currentRuleKey ? getRule(currentRuleKey) ?? null : null,
  );
  const [outcomeSuccess, setOutcomeSuccess] = useState<boolean | null>(
    (currentRuleOutcome?.success as boolean | undefined) ?? null,
  );
  const [partnerPlayerNumber, setPartnerPlayerNumber] = useState<number | null>(
    currentPartnerPlayerNumbers?.[0] ?? null,
  );

  const enterScore = useEnterScore();
  const ruleActivations = useRuleActivations();
  const players = useTournamentPlayers();

  // Rules this player has already burned. Don't show them as available again.
  const usedRuleKeys = useMemo(
    () =>
      new Set(
        (ruleActivations.data ?? [])
          .filter(
            (a) =>
              a.primary_player_number === player.player_number &&
              a.rule_key !== currentRuleKey,
          )
          .map((a) => a.rule_key),
      ),
    [ruleActivations.data, player.player_number, currentRuleKey],
  );

  const eligibilityCtx: EligibilityContext = useMemo(
    () => ({
      hole: {
        par: hole.par,
        course_id: hole.course_id,
        hole_number: hole.hole_number,
      },
      usedRuleKeys,
      ruleAppliedThisHole: currentRuleKey ?? undefined,
      phase: 'score_entry',
    }),
    [hole, usedRuleKeys, currentRuleKey],
  );

  // Lock background scroll.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const ruleOutcome: RuleOutcome = useMemo(
    () => ({
      strokes,
      par: hole.par,
      success: outcomeSuccess ?? undefined,
    }),
    [strokes, hole.par, outcomeSuccess],
  );

  // Rule that will actually be applied: either the explicit pick OR the
  // incoming partner rule (someone else committed this player as a partner).
  const effectiveRule: Rule | null = useMemo(() => {
    if (selectedRule) return selectedRule;
    if (incomingPartnerRuleKey) return getRule(incomingPartnerRuleKey) ?? null;
    return null;
  }, [selectedRule, incomingPartnerRuleKey]);

  const ruleDelta = effectiveRule ? effectiveRule.computeDelta(ruleOutcome) : 0;
  const baseToPar = strokes - hole.par;
  const adjustedToPar = baseToPar + ruleDelta;

  const needsSuccessChoice =
    selectedRule != null && SUCCESS_RULES.has(selectedRule.key) && outcomeSuccess == null;
  const needsPartner =
    selectedRule != null &&
    MULTI_PLAYER_NEEDS_PARTNER.has(selectedRule.key) &&
    partnerPlayerNumber == null;

  const canSave = !needsSuccessChoice && !needsPartner;

  // Card-mates we can offer as partners.
  const cardMates = useMemo(
    () =>
      (players.data ?? []).filter(
        (p) =>
          p.card_number === player.card_number &&
          p.player_number !== player.player_number,
      ),
    [players.data, player.card_number, player.player_number],
  );

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await enterScore.mutateAsync({
        tournament_id,
        player_number: player.player_number,
        hole_id: hole.id,
        strokes,
        par_snapshot: hole.par,
        rule_delta: ruleDelta,
        entered_by_player_number: enteredByPlayerNumber,
        player_display_name: player.display_name,
        hole_number: hole.hole_number,
        course_id: hole.course_id,
        rule: selectedRule
          ? {
              rule_key: selectedRule.key,
              outcome: SUCCESS_RULES.has(selectedRule.key)
                ? { success: outcomeSuccess }
                : null,
              partner_player_numbers:
                MULTI_PLAYER_NEEDS_PARTNER.has(selectedRule.key) && partnerPlayerNumber != null
                  ? [partnerPlayerNumber]
                  : null,
            }
          : undefined,
      });
      toast.success(`Saved ${player.display_name}: ${strokes} on H${hole.hole_number}`);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not save: ${msg}`);
    }
  };

  const toggleRulesSection = () => {
    if (showRules) {
      setShowRules(false);
      setSelectedRule(null);
      setOutcomeSuccess(null);
      setPartnerPlayerNumber(null);
    } else {
      setShowRules(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 -z-10 bg-slate-950/70 backdrop-blur"
      />

      <div className="mx-auto flex max-h-[92vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-2xl border-x border-t border-slate-800 bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <Avatar
            avatarId={player.person?.avatar_id}
            displayName={player.display_name}
            size={48}
          />
          <div className="flex-1 min-w-0">
            <div className="truncate text-base font-semibold">{player.display_name}</div>
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Hole {hole.hole_number} · Par {hole.par}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="rounded-md bg-slate-800 px-3 py-1 text-sm"
          >
            Cancel
          </button>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
          {hole.pin_placement && <span>Pin {hole.pin_placement}</span>}
          {hole.distance_ft && <span>{hole.distance_ft} ft</span>}
          {hole.notes && <span className="text-slate-500">{hole.notes}</span>}
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setStrokes((s) => Math.max(1, s - 1))}
            disabled={strokes <= 1}
            className="h-14 w-14 rounded-full bg-slate-800 text-2xl font-semibold text-slate-100 disabled:opacity-40"
          >
            −
          </button>
          <div className="flex w-28 flex-col items-center">
            <div className="text-5xl font-bold tabular-nums">{strokes}</div>
            <div className="text-xs uppercase tracking-wider text-slate-400">
              {formatToPar(baseToPar)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStrokes((s) => Math.min(15, s + 1))}
            disabled={strokes >= 15}
            className="h-14 w-14 rounded-full bg-slate-800 text-2xl font-semibold text-slate-100 disabled:opacity-40"
          >
            +
          </button>
        </div>

        {/* Inbound partner rule — someone else committed this player. */}
        {incomingPartnerRuleKey && (
          <div className="rounded-xl border border-gold-500/40 bg-gold-500/10 p-3 text-xs">
            <div className="font-semibold text-gold-300">
              {getRule(incomingPartnerRuleKey)?.emoji}{' '}
              {getRule(incomingPartnerRuleKey)?.displayName} (incoming)
            </div>
            <div className="text-slate-300">
              {incomingPartnerPrimaryName ?? 'A partner'} committed you to this rule.
              The delta is applied automatically.
            </div>
          </div>
        )}

        {/* Rule section — picking your own rule */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <button
            type="button"
            onClick={toggleRulesSection}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-slate-200">
              {showRules ? '✓ Apply a rule' : 'Apply a rule?'}
            </span>
            <span className="text-xs text-slate-500">
              {showRules ? 'tap to remove' : 'tap to add'}
            </span>
          </button>

          {showRules && (
            <div className="mt-3 flex flex-col gap-3">
              <RulePicker
                ctx={eligibilityCtx}
                selectedKey={selectedRule?.key ?? null}
                onSelect={(r) => {
                  setSelectedRule(r);
                  setOutcomeSuccess(null);
                  setPartnerPlayerNumber(null);
                }}
              />

              {selectedRule && SUCCESS_RULES.has(selectedRule.key) && (
                <SuccessFailToggle
                  ruleName={selectedRule.displayName}
                  value={outcomeSuccess}
                  onChange={setOutcomeSuccess}
                />
              )}

              {selectedRule && MULTI_PLAYER_NEEDS_PARTNER.has(selectedRule.key) && (
                <PartnerPicker
                  candidates={cardMates}
                  selectedPlayerNumber={partnerPlayerNumber}
                  onChange={setPartnerPlayerNumber}
                  label={`Partner for ${selectedRule.displayName}`}
                />
              )}

              {selectedRule?.requiresPhoto && (
                <p className="text-[11px] text-amber-400/80">
                  📷 Photo upload comes in Phase 13 — rule applies for now without one.
                </p>
              )}

              {selectedRule?.shape === 'whole_card' && (
                <p className="text-[11px] text-amber-400/80">
                  This rule's delta applies to the entire card. Cross-row math
                  for {selectedRule.displayName} lands with Phase 16 hole-complete
                  detection.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Live preview */}
        <PreviewBar
          strokes={strokes}
          par={hole.par}
          baseToPar={baseToPar}
          ruleDelta={ruleDelta}
          adjustedToPar={adjustedToPar}
          rule={effectiveRule}
        />

        <button
          type="button"
          onClick={handleSave}
          disabled={enterScore.isPending || !canSave}
          className="w-full rounded-xl bg-gold-500 px-4 py-3 text-base font-semibold text-slate-950 transition-colors disabled:opacity-50"
        >
          {enterScore.isPending
            ? 'Saving…'
            : needsSuccessChoice
              ? `Pick outcome for ${selectedRule?.displayName}`
              : needsPartner
                ? `Pick partner for ${selectedRule?.displayName}`
                : 'Save'}
        </button>
      </div>
    </div>
  );
}

function SuccessFailToggle({
  ruleName,
  value,
  onChange,
}: {
  ruleName: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        Outcome for {ruleName}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={[
            'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            value === true
              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
              : 'border-slate-800 bg-slate-900 text-slate-300 active:bg-slate-800',
          ].join(' ')}
        >
          ✓ Made it
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={[
            'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
            value === false
              ? 'border-rose-500 bg-rose-500/15 text-rose-300'
              : 'border-slate-800 bg-slate-900 text-slate-300 active:bg-slate-800',
          ].join(' ')}
        >
          ✗ Missed
        </button>
      </div>
    </div>
  );
}

function PreviewBar({
  strokes,
  par,
  baseToPar,
  ruleDelta,
  adjustedToPar,
  rule,
}: {
  strokes: number;
  par: number;
  baseToPar: number;
  ruleDelta: number;
  adjustedToPar: number;
  rule: Rule | null;
}) {
  const cat = categorize(strokes, par);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
      <div
        className={[
          'flex h-10 w-10 items-center justify-center text-base font-semibold tabular-nums',
          cellClasses(cat),
        ].join(' ')}
      >
        {strokes}
      </div>
      <div className="flex-1 text-xs text-slate-400">
        <div>
          <span className="text-slate-300">{formatToPar(baseToPar)}</span>
          {rule && ruleDelta !== 0 && (
            <>
              {' + '}
              <span className="text-gold-400">
                {rule.displayName} {ruleDelta > 0 ? `+${ruleDelta}` : ruleDelta}
              </span>
            </>
          )}
          {rule && ruleDelta === 0 && (
            <>
              {' + '}
              <span className="text-slate-500">{rule.displayName} (0)</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Adjusted</div>
        <div className="text-lg font-bold tabular-nums text-slate-100">
          {formatToPar(adjustedToPar)}
        </div>
      </div>
    </div>
  );
}
