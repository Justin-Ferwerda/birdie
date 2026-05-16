import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useScores } from '../hooks/useScores';
import { useRuleActivations } from '../hooks/useRuleActivations';
import { useMyPlayer } from '../hooks/useMyPlayer';
import Avatar from '../components/Avatar';
import { formatToPar } from '../lib/scoring';
import { isFullTournamentPlayer } from '../types/database';
import type { CourseId } from '../types/database';

type Mode = 'adjusted' | 'raw';

interface Row {
  player_number: number;
  display_name: string;
  card_number: number;
  avatar_id: string | null;
  thru: number;
  raw_to_par: number;
  adjusted_to_par: number;
  rules_burned: number;
  allowed_courses: CourseId[] | null;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const players = useTournamentPlayers();
  const scores = useScores();
  const activations = useRuleActivations();
  const { playerNumber: myPlayerNumber } = useMyPlayer();
  const [mode, setMode] = useState<Mode>('adjusted');

  const rows: Row[] = useMemo(() => {
    if (!players.data) return [];
    const rulesByPlayer = new Map<number, number>();
    (activations.data ?? []).forEach((a) => {
      rulesByPlayer.set(
        a.primary_player_number,
        (rulesByPlayer.get(a.primary_player_number) ?? 0) + 1,
      );
    });

    return players.data.map((p) => {
      const mine = (scores.data ?? []).filter((s) => s.player_number === p.player_number);
      const thru = mine.length;
      const raw = mine.reduce((acc, s) => acc + s.hole_score_to_par, 0);
      const adjusted = mine.reduce(
        (acc, s) => acc + s.adjusted_score_to_par,
        0,
      );
      return {
        player_number: p.player_number,
        display_name: p.display_name,
        card_number: p.card_number,
        avatar_id: p.person?.avatar_id ?? null,
        thru,
        raw_to_par: raw,
        adjusted_to_par: adjusted,
        rules_burned: rulesByPlayer.get(p.player_number) ?? 0,
        allowed_courses: p.allowed_courses,
      };
    });
  }, [players.data, scores.data, activations.data]);

  const sortRows = (input: Row[]) =>
    [...input].sort((a, b) => {
      const score =
        mode === 'adjusted'
          ? a.adjusted_to_par - b.adjusted_to_par
          : a.raw_to_par - b.raw_to_par;
      if (score !== 0) return score;
      if (a.thru !== b.thru) return b.thru - a.thru;
      return a.display_name.localeCompare(b.display_name);
    });

  const mainSorted = useMemo(
    () => sortRows(rows.filter((r) => isFullTournamentPlayer(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mode],
  );
  const guestSorted = useMemo(
    () => sortRows(rows.filter((r) => !isFullTournamentPlayer(r))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, mode],
  );

  // Tied position labels (golf convention: "T2" when ties).
  const positionsFor = (sorted: Row[]) => {
    const out: string[] = [];
    let i = 0;
    while (i < sorted.length) {
      const v = scoreOf(sorted[i], mode);
      let j = i + 1;
      while (j < sorted.length && scoreOf(sorted[j], mode) === v) j++;
      const isTie = j - i > 1;
      for (let k = i; k < j; k++) {
        out.push(`${isTie ? 'T' : ''}${i + 1}`);
      }
      i = j;
    }
    return out;
  };
  const mainPositions = useMemo(
    () => positionsFor(mainSorted),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mainSorted, mode],
  );
  const guestPositions = useMemo(
    () => positionsFor(guestSorted),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guestSorted, mode],
  );

  return (
    <section className="mx-auto flex max-w-md flex-col gap-3 px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Leaderboard</h2>
        <div className="flex gap-1 rounded-md border border-slate-800 bg-slate-900 p-0.5 text-xs">
          {(['adjusted', 'raw'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                'rounded-sm px-2 py-1 transition-colors',
                mode === m
                  ? 'bg-gold-500 text-slate-950 font-semibold'
                  : 'text-slate-400',
              ].join(' ')}
            >
              {m === 'adjusted' ? 'Adjusted' : 'Raw'}
            </button>
          ))}
        </div>
      </header>

      {players.isLoading && (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      )}

      {!players.isLoading && mainSorted.length === 0 && guestSorted.length === 0 && (
        <p className="rounded-md border border-slate-800 bg-slate-900/60 p-4 text-center text-xs text-slate-500">
          No players yet.
        </p>
      )}

      {mainSorted.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {mainSorted.map((r, i) => (
            <LeaderboardRow
              key={r.player_number}
              row={r}
              position={mainPositions[i]}
              isMe={r.player_number === myPlayerNumber}
              mode={mode}
              onWalletTap={(pn) => navigate(`/wallet/${pn}`)}
            />
          ))}
        </ol>
      )}

      {guestSorted.length > 0 && (
        <>
          <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">
            Guests
          </div>
          <ol className="flex flex-col gap-1.5 opacity-90">
            {guestSorted.map((r, i) => (
              <LeaderboardRow
                key={r.player_number}
                row={r}
                position={guestPositions[i]}
                isMe={r.player_number === myPlayerNumber}
                mode={mode}
                onWalletTap={(pn) => navigate(`/wallet/${pn}`)}
                isGuest
              />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

interface LeaderboardRowProps {
  row: Row;
  position: string;
  isMe: boolean;
  mode: Mode;
  onWalletTap: (player_number: number) => void;
  isGuest?: boolean;
}

function LeaderboardRow({
  row: r,
  position,
  isMe,
  mode,
  onWalletTap,
  isGuest,
}: LeaderboardRowProps) {
  const score = scoreOf(r, mode);
  return (
    <li>
      <Link
        to={`/scorecard?card=${r.card_number}`}
        className={[
          'flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
          isMe
            ? 'border-emerald-700/70 bg-emerald-900/15'
            : 'border-slate-800 bg-slate-900/60 active:bg-slate-800',
        ].join(' ')}
      >
        <div className="w-7 text-center text-xs font-semibold tabular-nums text-slate-400">
          {isGuest ? '·' : position}
        </div>
        <Avatar avatarId={r.avatar_id} displayName={r.display_name} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-slate-100">
              {r.display_name}
            </span>
            {isGuest && (
              <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] uppercase tracking-wider text-slate-400">
                Guest
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-slate-500">
            <span>Card {r.card_number}</span>
            <span>· Thru {r.thru}</span>
            {isGuest && r.allowed_courses && (
              <span>
                ·{' '}
                {r.allowed_courses
                  .map((c) =>
                    c === 'seven_oaks' ? 'SO' : c === 'crockett' ? 'CR' : 'CH',
                  )
                  .join('+')}
              </span>
            )}
            {r.rules_burned > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onWalletTap(r.player_number);
                }}
                className="uppercase tracking-wider hover:text-gold-300"
                title={`Open ${r.display_name}'s rule wallet`}
              >
                · 🎒 {r.rules_burned}
              </button>
            )}
          </div>
        </div>
        <div
          className={[
            'text-right text-lg font-bold tabular-nums',
            scoreColor(score),
          ].join(' ')}
        >
          {r.thru === 0 ? '—' : formatToPar(score)}
        </div>
      </Link>
    </li>
  );
}

function scoreOf(r: Row, mode: Mode): number {
  return mode === 'adjusted' ? r.adjusted_to_par : r.raw_to_par;
}

function scoreColor(toPar: number): string {
  if (toPar < 0) return 'text-gold-400';
  if (toPar > 0) return 'text-rose-300';
  return 'text-slate-200';
}
