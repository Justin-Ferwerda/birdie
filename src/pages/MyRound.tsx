import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useHoles } from '../hooks/useHoles';
import { useScores } from '../hooks/useScores';
import { useRuleActivations } from '../hooks/useRuleActivations';
import { useMyPlayer } from '../hooks/useMyPlayer';
import Avatar from '../components/Avatar';
import { categorize, formatToPar, type ScoreCategory } from '../lib/scoring';
import { getRule } from '../config/rules';
import type { CourseId, Score } from '../types/database';

const COURSE_ORDER: CourseId[] = ['seven_oaks', 'crockett', 'cedar_hill'];
const COURSE_LABEL: Record<CourseId, string> = {
  seven_oaks: 'Seven Oaks',
  crockett: 'Crockett',
  cedar_hill: 'Cedar Hill',
};

const CATEGORY_META: Record<
  ScoreCategory,
  { icon: string; label: string; cls: string }
> = {
  ace:           { icon: '🥇', label: 'Aces',          cls: 'text-gold-300' },
  eagle:         { icon: '🦅', label: 'Eagles',        cls: 'text-fuchsia-300' },
  birdie:        { icon: '🐦', label: 'Birdies',       cls: 'text-gold-400' },
  par:           { icon: '⚪', label: 'Pars',          cls: 'text-slate-200' },
  bogey:         { icon: '🟡', label: 'Bogeys',        cls: 'text-amber-300' },
  double_bogey:  { icon: '🔴', label: 'Doubles',       cls: 'text-orange-300' },
  worse:         { icon: '💀', label: 'Worse',         cls: 'text-rose-300' },
};

const CATEGORY_ORDER: ScoreCategory[] = [
  'ace',
  'eagle',
  'birdie',
  'par',
  'bogey',
  'double_bogey',
  'worse',
];

export default function MyRound() {
  const tournament = useActiveTournament();
  const players = useTournamentPlayers();
  const holesQ = useHoles();
  const scoresQ = useScores();
  const activationsQ = useRuleActivations();
  const { playerNumber } = useMyPlayer();

  const me = useMemo(
    () => players.data?.find((p) => p.player_number === playerNumber) ?? null,
    [players.data, playerNumber],
  );

  const myScores = useMemo(
    () => (scoresQ.data ?? []).filter((s) => s.player_number === playerNumber),
    [scoresQ.data, playerNumber],
  );

  // hole_id → course_id lookup
  const holeIndex = useMemo(() => {
    const m = new Map<string, { course_id: CourseId; hole_number: number; par: number }>();
    (holesQ.data ?? []).forEach((h) =>
      m.set(h.id, { course_id: h.course_id, hole_number: h.hole_number, par: h.par }),
    );
    return m;
  }, [holesQ.data]);

  // Category counts overall + per course
  const totalCategoryCounts = useMemo(
    () => countByCategory(myScores),
    [myScores],
  );

  const perCourse = useMemo(() => {
    const out: Record<CourseId, ReturnType<typeof courseStats>> = {} as never;
    for (const c of COURSE_ORDER) {
      const courseScores = myScores.filter(
        (s) => holeIndex.get(s.hole_id)?.course_id === c,
      );
      out[c] = courseStats(courseScores);
    }
    return out;
  }, [myScores, holeIndex]);

  // Field per-hole average (adjusted) per course, for the "vs field" line.
  const fieldAvgPerCourse = useMemo(() => {
    const all = scoresQ.data ?? [];
    const out: Record<CourseId, number | null> = {} as never;
    for (const c of COURSE_ORDER) {
      const courseScores = all.filter((s) => holeIndex.get(s.hole_id)?.course_id === c);
      if (courseScores.length === 0) {
        out[c] = null;
        continue;
      }
      const sum = courseScores.reduce((acc, s) => acc + s.adjusted_score_to_par, 0);
      out[c] = sum / courseScores.length;
    }
    return out;
  }, [scoresQ.data, holeIndex]);

  // Rule activations where I'm primary, sorted newest first.
  const myActivations = useMemo(() => {
    return (activationsQ.data ?? [])
      .filter((a) => a.primary_player_number === playerNumber)
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }, [activationsQ.data, playerNumber]);

  // Exclusivity (provisional): holes where I have the best raw score-to-par
  // AND it's a birdie/eagle/ace AND I'm the only one with that or better,
  // across players who have already scored that hole.
  const exclusiveHighlights = useMemo(() => {
    const all = scoresQ.data ?? [];
    const result: { score: Score; category: ScoreCategory; provisional: boolean }[] = [];
    const N = players.data?.length ?? 0;

    for (const s of myScores) {
      const cat = categorize(s.strokes, s.par_snapshot);
      if (cat !== 'ace' && cat !== 'eagle' && cat !== 'birdie') continue;
      const sameHole = all.filter((x) => x.hole_id === s.hole_id);
      const othersBeatOrTie = sameHole.some(
        (x) => x.player_number !== s.player_number && x.hole_score_to_par <= s.hole_score_to_par,
      );
      if (!othersBeatOrTie) {
        result.push({
          score: s,
          category: cat,
          provisional: sameHole.length < N,
        });
      }
    }
    return result;
  }, [scoresQ.data, myScores, players.data]);

  if (!me) {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-2 px-4 py-6 text-sm text-slate-400">
        Pick yourself on the identity picker first.
      </section>
    );
  }

  const totalRaw = myScores.reduce((acc, s) => acc + s.hole_score_to_par, 0);
  const totalAdjusted = myScores.reduce((acc, s) => acc + s.adjusted_score_to_par, 0);

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-4">
      <header className="flex items-center gap-3">
        <Avatar avatarId={me.person?.avatar_id} displayName={me.display_name} size={56} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            {tournament.data?.name ?? 'Tournament'}
          </div>
          <div className="truncate text-xl font-semibold">{me.display_name}</div>
          <div className="text-xs text-slate-400">
            Card {me.card_number}
            {me.is_scorekeeper && ' · Scorekeeper'}
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Score</div>
            <div className="text-3xl font-bold tabular-nums text-slate-100">
              {myScores.length === 0 ? '—' : formatToPar(totalAdjusted)}
            </div>
            {totalAdjusted !== totalRaw && myScores.length > 0 && (
              <div className="text-[11px] text-slate-500">
                raw {formatToPar(totalRaw)}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-slate-400">
            Thru {myScores.length}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {COURSE_ORDER.map((c) => {
            const stats = perCourse[c];
            const mineAvg =
              stats.thru === 0 ? null : stats.adjusted / stats.thru;
            const fieldAvg = fieldAvgPerCourse[c];
            const diff =
              mineAvg != null && fieldAvg != null
                ? mineAvg - fieldAvg
                : null;
            return (
              <div
                key={c}
                className="rounded-lg border border-slate-800 bg-slate-950 p-2"
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  {COURSE_LABEL[c]}
                </div>
                <div className="text-base font-semibold text-slate-100">
                  {stats.thru === 0 ? '—' : formatToPar(stats.adjusted)}
                </div>
                <div className="text-[10px] text-slate-500">
                  {stats.thru === 0
                    ? '—'
                    : diff == null
                      ? `thru ${stats.thru}`
                      : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} vs field`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category counters */}
      <div className="grid grid-cols-4 gap-2">
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const count = totalCategoryCounts[cat];
          return (
            <div
              key={cat}
              className={[
                'flex flex-col items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-center',
                count === 0 && 'opacity-50',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="text-lg leading-none">{meta.icon}</div>
              <div className={`text-base font-semibold tabular-nums ${meta.cls}`}>
                {count}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">
                {meta.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rules used */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Rules used</h3>
          <Link
            to={`/wallet/${me.player_number}`}
            className="text-xs text-slate-400 underline-offset-2 hover:underline"
          >
            🎒 Wallet ({myActivations.length})
          </Link>
        </div>
        {myActivations.length === 0 ? (
          <p className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500">
            No rules yet. Tap "✏️ Declare a rule" on the scorecard, or pick
            one when entering a score.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {myActivations.map((a) => {
              const rule = getRule(a.rule_key);
              const holeInfo = a.hole_id ? holeIndex.get(a.hole_id) : null;
              const outcomeSuccess = (a.outcome as { success?: boolean } | null)
                ?.success;
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                >
                  <div className="text-lg leading-none">{rule?.emoji ?? '·'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-100">
                      {rule?.displayName ?? a.rule_key}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">
                      {holeInfo
                        ? `${COURSE_LABEL[holeInfo.course_id]} · H${holeInfo.hole_number}`
                        : 'no hole'}
                      {outcomeSuccess != null && (
                        <span className={outcomeSuccess ? ' text-emerald-300' : ' text-rose-300'}>
                          {' · '}{outcomeSuccess ? 'made it' : 'missed'}
                        </span>
                      )}
                    </div>
                  </div>
                  {a.delta_applied != null && a.delta_applied !== 0 && (
                    <div className="text-sm font-semibold tabular-nums text-gold-400">
                      {a.delta_applied > 0
                        ? `+${a.delta_applied}`
                        : a.delta_applied}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Exclusivity highlights */}
      {exclusiveHighlights.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-slate-200">
            ✨ Exclusivity{' '}
            <span className="text-xs font-normal text-slate-500">
              {exclusiveHighlights.some((h) => h.provisional) && '(provisional)'}
            </span>
          </h3>
          <ul className="flex flex-col gap-1.5">
            {exclusiveHighlights.map(({ score, category, provisional }) => {
              const meta = CATEGORY_META[category];
              const holeInfo = holeIndex.get(score.hole_id);
              return (
                <li
                  key={score.id}
                  className="flex items-center gap-3 rounded-lg border border-gold-500/50 bg-gold-500/5 px-3 py-2"
                >
                  <div className="text-lg leading-none">{meta.icon}</div>
                  <div className="min-w-0 flex-1 text-xs text-gold-200">
                    Only one to{' '}
                    {category === 'ace' ? 'ace' : category === 'eagle' ? 'eagle' : 'birdie'}{' '}
                    {holeInfo &&
                      `${COURSE_LABEL[holeInfo.course_id]} H${holeInfo.hole_number}`}
                    {provisional && (
                      <span className="ml-1 text-[10px] text-slate-500">
                        (not all scored)
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

function countByCategory(scores: Score[]): Record<ScoreCategory, number> {
  const counts: Record<ScoreCategory, number> = {
    ace: 0,
    eagle: 0,
    birdie: 0,
    par: 0,
    bogey: 0,
    double_bogey: 0,
    worse: 0,
  };
  for (const s of scores) {
    counts[categorize(s.strokes, s.par_snapshot)]++;
  }
  return counts;
}

function courseStats(scores: Score[]) {
  const raw = scores.reduce((acc, s) => acc + s.hole_score_to_par, 0);
  const adjusted = scores.reduce((acc, s) => acc + s.adjusted_score_to_par, 0);
  return { thru: scores.length, raw, adjusted };
}
