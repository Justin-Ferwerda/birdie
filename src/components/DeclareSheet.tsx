import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  RULES,
  getRule,
  type EligibilityContext,
  type Rule,
  type RuleShape,
} from '../config/rules';
import { useDeclareRule } from '../hooks/useDeclareRule';
import { useRuleActivations } from '../hooks/useRuleActivations';
import { useScores } from '../hooks/useScores';
import Avatar from './Avatar';
import PartnerPicker from './PartnerPicker';
import type { Hole, CourseId } from '../types/database';
import type { TournamentPlayerWithPerson } from '../hooks/useTournamentPlayers';

/** Rules surfaced by the Declare/Activate sheet. */
const DECLARE_SHAPES: ReadonlySet<RuleShape> = new Set([
  'pre_declared',
  'cross_card_target',
  'whole_card',
  'multi_player', // scramble_up (mustDeclare); others filter out by phase
]);

interface DeclareSheetProps {
  tournament_id: string;
  primary: TournamentPlayerWithPerson;
  cardPlayers: TournamentPlayerWithPerson[];
  allPlayers: TournamentPlayerWithPerson[];
  courseHoles: Hole[];
  courseId: CourseId;
  onClose: () => void;
}

export default function DeclareSheet({
  tournament_id,
  primary,
  cardPlayers,
  allPlayers,
  courseHoles,
  courseId: _courseId,
  onClose,
}: DeclareSheetProps) {
  const declare = useDeclareRule();
  const activations = useRuleActivations();
  const scores = useScores();

  const [holeId, setHoleId] = useState<string>(courseHoles[0]?.id ?? '');
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [partnerNumber, setPartnerNumber] = useState<number | null>(null);
  const [targetNumber, setTargetNumber] = useState<number | null>(null);

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

  const hole = useMemo(
    () => courseHoles.find((h) => h.id === holeId) ?? null,
    [courseHoles, holeId],
  );

  const usedRuleKeys = useMemo(
    () =>
      new Set(
        (activations.data ?? [])
          .filter((a) => a.primary_player_number === primary.player_number)
          .map((a) => a.rule_key),
      ),
    [activations.data, primary.player_number],
  );

  const eligibilityCtx: EligibilityContext | null = hole && {
    hole: { par: hole.par, course_id: hole.course_id, hole_number: hole.hole_number },
    usedRuleKeys,
    phase: 'declare',
  };

  const availableRules = useMemo(() => {
    if (!eligibilityCtx) return [];
    return RULES.filter(
      (r) => DECLARE_SHAPES.has(r.shape) && r.eligible(eligibilityCtx),
    );
  }, [eligibilityCtx]);

  // Players whose scores would disqualify a hole for this declaration.
  // - pre_declared (birdie_for_shurdy): primary
  // - multi_player + mustDeclare (scramble_up): primary + partner
  // - whole_card (gentlemens_tee / play_through_parade): everyone on the card
  // - cross_card_target (putter_sabotage): the target only
  const relevantPlayerNumbers = useMemo<number[]>(() => {
    if (!selectedRule) return [];
    if (selectedRule.shape === 'cross_card_target') {
      return targetNumber != null ? [targetNumber] : [];
    }
    const nums = new Set<number>();
    nums.add(primary.player_number);
    if (selectedRule.key === 'scramble_up' && partnerNumber != null) {
      nums.add(partnerNumber);
    }
    if (selectedRule.shape === 'whole_card') {
      cardPlayers.forEach((p) => nums.add(p.player_number));
    }
    return Array.from(nums);
  }, [selectedRule, partnerNumber, targetNumber, primary.player_number, cardPlayers]);

  // Hole IDs where at least one relevant player has already scored on this course.
  const blockedHoleIds = useMemo(() => {
    if (relevantPlayerNumbers.length === 0) return new Set<string>();
    return new Set(
      (scores.data ?? [])
        .filter((s) => relevantPlayerNumbers.includes(s.player_number))
        .map((s) => s.hole_id),
    );
  }, [scores.data, relevantPlayerNumbers]);

  // If the user already picked a hole that just became blocked (because they
  // selected a target / partner), bump them to the first available hole.
  useEffect(() => {
    if (!blockedHoleIds.has(holeId)) return;
    const next = courseHoles.find((h) => !blockedHoleIds.has(h.id));
    setHoleId(next?.id ?? '');
  }, [blockedHoleIds, holeId, courseHoles]);

  const holeBlocked = blockedHoleIds.has(holeId);
  const needsPartner =
    selectedRule != null &&
    selectedRule.key === 'scramble_up' &&
    partnerNumber == null;
  const needsTarget =
    selectedRule != null &&
    selectedRule.shape === 'cross_card_target' &&
    targetNumber == null;

  const canSave =
    selectedRule != null &&
    hole != null &&
    !holeBlocked &&
    !needsPartner &&
    !needsTarget;

  const handleSave = async () => {
    if (!canSave || !hole) return;
    const targetPlayer =
      targetNumber != null
        ? allPlayers.find((p) => p.player_number === targetNumber)
        : null;
    try {
      await declare.mutateAsync({
        tournament_id,
        rule_key: selectedRule.key,
        primary_player_number: primary.player_number,
        hole_id: hole.id,
        card_number:
          selectedRule.shape === 'whole_card' || selectedRule.shape === 'pre_declared'
            ? primary.card_number
            : null,
        partner_player_numbers:
          partnerNumber != null ? [partnerNumber] : null,
        target_player_number: targetNumber,
        primary_display_name: primary.display_name,
        target_display_name: targetPlayer?.display_name,
        hole_number: hole.hole_number,
        course_id: hole.course_id,
      });
      toast.success(
        `Declared ${selectedRule.displayName} for hole ${hole.hole_number}`,
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not declare: ${msg}`);
    }
  };

  const targetCandidates = useMemo(
    () => allPlayers.filter((p) => p.card_number !== primary.card_number),
    [allPlayers, primary.card_number],
  );

  const cardMates = useMemo(
    () =>
      cardPlayers.filter((p) => p.player_number !== primary.player_number),
    [cardPlayers, primary.player_number],
  );

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
            avatarId={primary.person?.avatar_id}
            displayName={primary.display_name}
            size={40}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider text-slate-400">
              Declare a rule
            </div>
            <div className="truncate text-base font-semibold">
              {primary.display_name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-800 px-3 py-1 text-sm"
          >
            Cancel
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            For hole
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {courseHoles.map((h) => {
              const blocked = blockedHoleIds.has(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => setHoleId(h.id)}
                  className={[
                    'flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md text-xs transition-colors',
                    blocked
                      ? 'bg-slate-900 text-slate-700 line-through'
                      : holeId === h.id
                        ? 'bg-gold-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300',
                  ].join(' ')}
                  title={blocked ? 'A relevant player has already scored this hole' : undefined}
                >
                  <div className="leading-none">{h.hole_number}</div>
                  <div className="text-[9px] leading-none opacity-70">P{h.par}</div>
                </button>
              );
            })}
          </div>
          {selectedRule && blockedHoleIds.size > 0 && (
            <div className="text-[11px] text-slate-500">
              Greyed-out holes have already been scored by{' '}
              {selectedRule.shape === 'cross_card_target'
                ? 'the target'
                : 'a relevant player'}
              .
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            Rule
          </div>
          {availableRules.length === 0 ? (
            <p className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500">
              No rules available for this hole.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {availableRules.map((r) => {
                const isSelected = selectedRule?.key === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => {
                      setSelectedRule(isSelected ? null : r);
                      setPartnerNumber(null);
                      setTargetNumber(null);
                    }}
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
                    </div>
                    <p className="text-[11px] leading-snug text-slate-400">
                      {r.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedRule?.key === 'scramble_up' && (
          <PartnerPicker
            candidates={cardMates}
            selectedPlayerNumber={partnerNumber}
            onChange={setPartnerNumber}
            label={`Partner for ${selectedRule.displayName}`}
          />
        )}

        {selectedRule?.shape === 'cross_card_target' && (
          <PartnerPicker
            candidates={targetCandidates}
            selectedPlayerNumber={targetNumber}
            onChange={setTargetNumber}
            label="Sabotage which player?"
          />
        )}

        {selectedRule?.shape === 'whole_card' && (
          <p className="text-[11px] text-amber-400/80">
            Applies to all {cardPlayers.length} players on Card{' '}
            {primary.card_number}. Cross-row delta math lands with Phase 16.
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || declare.isPending}
          className="w-full rounded-xl bg-gold-500 px-4 py-3 text-base font-semibold text-slate-950 transition-colors disabled:opacity-50"
        >
          {declare.isPending
            ? 'Saving…'
            : !selectedRule
              ? 'Pick a rule'
              : needsPartner
                ? `Pick partner for ${selectedRule.displayName}`
                : needsTarget
                  ? `Pick target for ${selectedRule.displayName}`
                  : holeBlocked
                    ? 'Pick an unscored hole'
                    : `Declare ${selectedRule.displayName} for H${hole?.hole_number}`}
        </button>
      </div>
    </div>
  );
}

/** Exported helper so the Scorecard can label primary-owned activations
 * by emoji + name when rendering badges. */
export function getRuleEmoji(rule_key: string): string {
  return getRule(rule_key)?.emoji ?? '·';
}
