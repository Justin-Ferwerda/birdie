import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { useHoles } from '../hooks/useHoles';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useScores } from '../hooks/useScores';
import { useRuleActivations } from '../hooks/useRuleActivations';
import { useMyPlayer } from '../hooks/useMyPlayer';
import Avatar from '../components/Avatar';
import ScoreEntrySheet from '../components/ScoreEntrySheet';
import DeclareSheet from '../components/DeclareSheet';
import MinigamesList from '../components/MinigamesList';
import { categorize, cellClasses, formatToPar } from '../lib/scoring';
import { getRule } from '../config/rules';
import { useCellPulse } from '../lib/celebrate';
import { computeTeeOrder } from '../lib/teeOrder';
import type { CourseId, Hole, RuleActivation, Score } from '../types/database';
import type { TournamentPlayerWithPerson } from '../hooks/useTournamentPlayers';

type TabKey = CourseId | 'minigames';

const TAB_ORDER: TabKey[] = ['seven_oaks', 'crockett', 'cedar_hill', 'minigames'];
const COURSE_LABEL: Record<CourseId, string> = {
  seven_oaks: 'Seven Oaks',
  crockett: 'Crockett',
  cedar_hill: 'Cedar Hill',
};
const TAB_LABEL: Record<TabKey, string> = {
  ...COURSE_LABEL,
  minigames: 'Minigames',
};

export default function Scorecard() {
  const tournament = useActiveTournament();
  const holes = useHoles();
  const players = useTournamentPlayers();
  const scores = useScores();
  const ruleActivations = useRuleActivations();
  const { playerNumber: myPlayerNumber } = useMyPlayer();

  const me = useMemo(
    () => players.data?.find((p) => p.player_number === myPlayerNumber) ?? null,
    [players.data, myPlayerNumber],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const initialCardFromUrl = (() => {
    const v = searchParams.get('card');
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n >= 1 && n <= 3 ? n : null;
  })();

  const [tabKey, setTabKey] = useState<TabKey>('seven_oaks');
  const courseId: CourseId =
    tabKey === 'minigames' ? 'seven_oaks' : tabKey;
  const [cardNumber, setCardNumber] = useState<number | null>(initialCardFromUrl);

  // Strip the query param once consumed so subsequent navigations to /scorecard
  // don't re-snap to that card.
  useEffect(() => {
    if (initialCardFromUrl != null && searchParams.has('card')) {
      const next = new URLSearchParams(searchParams);
      next.delete('card');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [entry, setEntry] = useState<{
    player: TournamentPlayerWithPerson;
    hole: Hole;
  } | null>(null);
  const [showDeclare, setShowDeclare] = useState(false);

  const activeCard = cardNumber ?? me?.card_number ?? 1;

  const cardNumbers = useMemo(() => {
    const set = new Set<number>();
    (players.data ?? []).forEach((p) => set.add(p.card_number));
    return Array.from(set).sort();
  }, [players.data]);

  const courseHoles = useMemo(
    () => (holes.data ?? []).filter((h) => h.course_id === courseId),
    [holes.data, courseId],
  );

  const cardPlayers = useMemo(
    () => (players.data ?? []).filter((p) => p.card_number === activeCard),
    [players.data, activeCard],
  );

  // Next-hole tee order for the active card on the active course.
  // "Next hole" = lowest hole_number where at least one card player has
  // not yet scored. Null when the whole card has finished the course.
  const teeOrderInfo = useMemo(() => {
    if (cardPlayers.length === 0 || courseHoles.length === 0) return null;
    const cardPlayerNumbers = cardPlayers.map((p) => p.player_number).sort((a, b) => a - b);
    const holeIds = courseHoles.map((h) => h.id);
    const cardScores = (scores.data ?? []).filter((s) =>
      cardPlayerNumbers.includes(s.player_number),
    );

    let nextHoleIndex = -1;
    for (let i = 0; i < courseHoles.length; i++) {
      const someoneMissing = cardPlayerNumbers.some(
        (pn) =>
          !cardScores.find(
            (s) => s.player_number === pn && s.hole_id === courseHoles[i].id,
          ),
      );
      if (someoneMissing) {
        nextHoleIndex = i;
        break;
      }
    }
    if (nextHoleIndex === -1) return null;

    const order = computeTeeOrder({
      cardPlayerNumbers,
      holeIds,
      scores: cardScores,
      holeIndex: nextHoleIndex,
    });
    return {
      hole: courseHoles[nextHoleIndex],
      order: order
        .map((pn) => cardPlayers.find((p) => p.player_number === pn))
        .filter((p): p is TournamentPlayerWithPerson => !!p),
    };
  }, [cardPlayers, courseHoles, scores.data]);

  const scoresByKey = useMemo(() => {
    const map = new Map<string, Score>();
    (scores.data ?? []).forEach((s) => {
      map.set(`${s.player_number}:${s.hole_id}`, s);
    });
    return map;
  }, [scores.data]);

  // Primary activation by (primary_player_number, hole_id).
  const primaryActivationByKey = useMemo(() => {
    const map = new Map<string, RuleActivation>();
    (ruleActivations.data ?? []).forEach((a) => {
      if (a.hole_id == null) return;
      map.set(`${a.primary_player_number}:${a.hole_id}`, a);
    });
    return map;
  }, [ruleActivations.data]);

  // Sabotage target lookup: (target_player_number, hole_id) → activation.
  const sabotageByKey = useMemo(() => {
    const map = new Map<string, RuleActivation>();
    (ruleActivations.data ?? []).forEach((a) => {
      if (a.rule_key !== 'putter_sabotage' || a.hole_id == null) return;
      if (a.target_player_number == null) return;
      map.set(`${a.target_player_number}:${a.hole_id}`, a);
    });
    return map;
  }, [ruleActivations.data]);

  // Incoming partner: for each (player, hole), is there an activation where
  // this player is named as a partner by someone else?
  const incomingPartnerByKey = useMemo(() => {
    const map = new Map<string, RuleActivation>();
    (ruleActivations.data ?? []).forEach((a) => {
      if (a.hole_id == null || !a.partner_player_numbers) return;
      a.partner_player_numbers.forEach((pn) => {
        map.set(`${pn}:${a.hole_id}`, a);
      });
    });
    return map;
  }, [ruleActivations.data]);

  const isMyCard = me?.card_number === activeCard;
  const canEdit = !!me?.is_scorekeeper && isMyCard;

  // Sabotage warnings for the active card (players on this card being targeted).
  const sabotageWarnings = useMemo(() => {
    const warnings: { player: TournamentPlayerWithPerson; hole: Hole }[] = [];
    for (const p of cardPlayers) {
      for (const h of courseHoles) {
        if (sabotageByKey.has(`${p.player_number}:${h.id}`)) {
          warnings.push({ player: p, hole: h });
        }
      }
    }
    return warnings;
  }, [cardPlayers, courseHoles, sabotageByKey]);

  if (tournament.isLoading || players.isLoading || holes.isLoading) {
    return <CenteredMessage>Loading scorecard…</CenteredMessage>;
  }

  return (
    <section className="flex flex-col gap-3 px-3 py-4">
      <TabBar value={tabKey} onChange={setTabKey} />

      {tabKey === 'minigames' ? (
        <MinigamesList />
      ) : (
        <>
          <CardTabs
        cards={cardNumbers}
        myCard={me?.card_number ?? null}
        value={activeCard}
        onChange={setCardNumber}
      />

      {!canEdit && (
        <p className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
          {isMyCard
            ? 'Read-only — only your card’s scorekeeper can enter scores.'
            : 'Read-only — switch to your own card to enter scores.'}
        </p>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={() => setShowDeclare(true)}
          className="self-start rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200"
        >
          ✏️ Declare a rule
        </button>
      )}

      {sabotageWarnings.length > 0 && (
        <div className="rounded-md border border-rose-800 bg-rose-900/30 px-3 py-2 text-xs">
          <div className="mb-1 font-semibold text-rose-300">🎯 Sabotage active</div>
          <ul className="text-rose-200/90">
            {sabotageWarnings.map((w) => (
              <li key={`${w.player.player_number}:${w.hole.id}`}>
                {w.player.display_name} — putter only on H{w.hole.hole_number}
              </li>
            ))}
          </ul>
        </div>
      )}

      {teeOrderInfo && (
        <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">
            Tee order · H{teeOrderInfo.hole.hole_number}
          </div>
          <ol className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {teeOrderInfo.order.map((p, i) => (
              <li
                key={p.player_number}
                className="flex items-center gap-1.5"
              >
                <span className="w-4 text-center text-[10px] font-semibold text-slate-500">
                  {i + 1}.
                </span>
                <Avatar
                  avatarId={p.person?.avatar_id}
                  displayName={p.display_name}
                  size={20}
                />
                <span className="text-slate-200">{p.display_name}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-32 min-w-32 bg-slate-900 px-2 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">
                Player
              </th>
              {courseHoles.map((h) => (
                <th
                  key={h.id}
                  className="min-w-9 px-1 py-2 text-center text-[10px] font-medium text-slate-500"
                >
                  <div>{h.hole_number}</div>
                  <div className="text-[9px] text-slate-600">P{h.par}</div>
                </th>
              ))}
              <th className="px-2 py-2 text-right text-[10px] uppercase tracking-wider text-slate-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {cardPlayers.map((p) => {
              const playerScores: (Score | undefined)[] = courseHoles.map((h) =>
                scoresByKey.get(`${p.player_number}:${h.id}`),
              );
              const totalStrokes = playerScores.reduce(
                (acc, s) => acc + (s?.strokes ?? 0),
                0,
              );
              const totalAdjustedToPar = playerScores.reduce((acc, s, i) => {
                if (!s) return acc;
                return acc + (s.strokes - courseHoles[i].par) + (s.rule_delta ?? 0);
              }, 0);
              // Across the whole tournament, not just this course, for badges.
              const allMine = (scores.data ?? []).filter(
                (s) => s.player_number === p.player_number,
              );
              const aceCount = allMine.filter((s) => s.strokes === 1).length;
              const eagleCount = allMine.filter(
                (s) => s.strokes > 1 && s.hole_score_to_par <= -2,
              ).length;
              return (
                <tr key={p.player_number} className="border-t border-slate-800">
                  <th className="sticky left-0 z-10 w-32 min-w-32 bg-slate-900 px-2 py-1.5 text-left align-top">
                    <div className="flex items-start gap-2">
                      <Avatar
                        avatarId={p.person?.avatar_id}
                        displayName={p.display_name}
                        size={28}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-1 gap-y-0">
                          <span className="text-xs font-medium leading-tight text-slate-100">
                            {p.display_name}
                          </span>
                          {aceCount > 0 && (
                            <span
                              className="text-[10px] leading-none"
                              title={`${aceCount} ace${aceCount === 1 ? '' : 's'}`}
                            >
                              🥇{aceCount > 1 && <sup>{aceCount}</sup>}
                            </span>
                          )}
                          {eagleCount > 0 && (
                            <span
                              className="text-[10px] leading-none"
                              title={`${eagleCount} eagle${eagleCount === 1 ? '' : 's'}`}
                            >
                              🦅{eagleCount > 1 && <sup>{eagleCount}</sup>}
                            </span>
                          )}
                        </div>
                        {p.is_scorekeeper && (
                          <div className="text-[9px] uppercase tracking-wider text-emerald-400">
                            SK
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                  {courseHoles.map((h, i) => {
                    const score = playerScores[i];
                    const primary = primaryActivationByKey.get(
                      `${p.player_number}:${h.id}`,
                    );
                    const incoming = incomingPartnerByKey.get(
                      `${p.player_number}:${h.id}`,
                    );
                    const sabotage = sabotageByKey.get(
                      `${p.player_number}:${h.id}`,
                    );
                    // The Classic only gets the 👖 cell badge when failed —
                    // clearing it is the expected outcome, no shame badge.
                    const primaryRuleKey =
                      primary?.rule_key === 'the_classic'
                        ? (primary.outcome as { success?: boolean } | null)
                            ?.success === false
                          ? primary.rule_key
                          : null
                        : primary?.rule_key ?? null;
                    return (
                      <ScoreCell
                        key={h.id}
                        playerNumber={p.player_number}
                        hole={h}
                        strokes={score?.strokes ?? null}
                        canEdit={canEdit}
                        primaryRuleKey={primaryRuleKey}
                        incomingRuleKey={incoming?.rule_key ?? null}
                        sabotage={!!sabotage}
                        onTap={() => setEntry({ player: p, hole: h })}
                      />
                    );
                  })}
                  <td className="px-2 py-1.5 text-right align-top tabular-nums">
                    {totalStrokes === 0 ? (
                      <span className="text-slate-600">–</span>
                    ) : (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-slate-100">{totalStrokes}</span>
                        <span className="text-[10px] text-gold-400">
                          {formatToPar(totalAdjustedToPar)}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {entry && tournament.data && me && (() => {
        const key = `${entry.player.player_number}:${entry.hole.id}`;
        const existingScore = scoresByKey.get(key);
        const primary = primaryActivationByKey.get(key);
        const incoming = incomingPartnerByKey.get(key);
        const incomingPrimaryName = incoming
          ? players.data?.find(
              (p) => p.player_number === incoming.primary_player_number,
            )?.display_name ?? null
          : null;
        return (
          <ScoreEntrySheet
            tournament_id={tournament.data.id}
            player={entry.player}
            hole={entry.hole}
            currentStrokes={existingScore?.strokes ?? null}
            currentRuleKey={primary?.rule_key ?? null}
            currentRuleOutcome={primary?.outcome ?? null}
            currentPartnerPlayerNumbers={primary?.partner_player_numbers ?? null}
            incomingPartnerRuleKey={incoming?.rule_key ?? null}
            incomingPartnerPrimaryName={incomingPrimaryName}
            enteredByPlayerNumber={me.player_number}
            onClose={() => setEntry(null)}
          />
        );
      })()}

      {showDeclare && tournament.data && me && (
            <DeclareSheet
              tournament_id={tournament.data.id}
              primary={me}
              cardPlayers={cardPlayers}
              allPlayers={players.data ?? []}
              courseHoles={courseHoles}
              courseId={courseId}
              onClose={() => setShowDeclare(false)}
            />
          )}
        </>
      )}
    </section>
  );
}

function TabBar({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
      {TAB_ORDER.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={[
            'flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors',
            value === t
              ? 'bg-gold-500 text-slate-950'
              : 'text-slate-300 active:bg-slate-800',
          ].join(' ')}
        >
          {TAB_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

function CardTabs({
  cards,
  myCard,
  value,
  onChange,
}: {
  cards: number[];
  myCard: number | null;
  value: number;
  onChange: (v: number | null) => void;
}) {
  if (cards.length <= 1) return null;
  return (
    <div className="flex gap-1">
      {cards.map((c) => {
        const isMine = c === myCard;
        const active = c === value;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={[
              'flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              active
                ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 active:bg-slate-800',
            ].join(' ')}
          >
            Card {c}
            {isMine && <span className="ml-1 text-[10px] text-emerald-400">·me</span>}
          </button>
        );
      })}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
      {children}
    </section>
  );
}

interface ScoreCellProps {
  playerNumber: number;
  hole: Hole;
  strokes: number | null;
  canEdit: boolean;
  primaryRuleKey: string | null;
  incomingRuleKey: string | null;
  sabotage: boolean;
  onTap: () => void;
}

function ScoreCell({
  playerNumber,
  hole,
  strokes,
  canEdit,
  primaryRuleKey,
  incomingRuleKey,
  sabotage,
  onTap,
}: ScoreCellProps) {
  const pulse = useCellPulse(`${playerNumber}:${hole.id}`);
  const category = strokes != null ? categorize(strokes, hole.par) : null;
  const activeRule = primaryRuleKey ?? incomingRuleKey ?? null;
  const ruleEmoji = activeRule ? getRule(activeRule)?.emoji : null;

  const pulseClass =
    pulse === 'ace'
      ? 'animate-cell-ace'
      : pulse === 'eagle'
        ? 'animate-cell-eagle'
        : pulse === 'birdie'
          ? 'animate-cell-birdie'
          : '';

  return (
    <td className="min-w-9 px-1 py-1.5 text-center align-top">
      <button
        type="button"
        disabled={!canEdit}
        onClick={onTap}
        className={[
          'flex h-8 w-8 items-center justify-center text-sm tabular-nums transition-colors',
          strokes != null ? cellClasses(category!) : 'rounded-md text-slate-700',
          canEdit && strokes == null && 'active:bg-slate-800',
          pulseClass,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {strokes ?? '–'}
      </button>
      <div className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] leading-none">
        {ruleEmoji && <span title={getRule(activeRule!)?.displayName}>{ruleEmoji}</span>}
        {sabotage && <span title="Putter Sabotage active">🎯</span>}
      </div>
    </td>
  );
}
