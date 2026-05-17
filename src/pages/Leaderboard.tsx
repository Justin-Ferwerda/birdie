import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useScores } from '../hooks/useScores';
import { useRuleActivations } from '../hooks/useRuleActivations';
import { useMyPlayer } from '../hooks/useMyPlayer';
import { useMinigames } from '../hooks/useMinigames';
import { useMinigamePlacements } from '../hooks/useMinigamePlacements';
import Avatar from '../components/Avatar';
import { formatToPar } from '../lib/scoring';
import type { Minigame, MinigamePlacement, Place } from '../types/database';

type Mode = 'adjusted' | 'raw';
type View = 'main' | 'minigames';

interface Row {
  player_number: number;
  display_name: string;
  card_number: number;
  avatar_id: string | null;
  thru: number;
  raw_to_par: number;
  adjusted_to_par: number;
  rules_burned: number;
}

interface MinigameRow {
  player_number: number;
  display_name: string;
  card_number: number;
  avatar_id: string | null;
  points: number;
  placements: { minigame: Minigame; place: Place }[];
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const players = useTournamentPlayers();
  const scores = useScores();
  const activations = useRuleActivations();
  const minigamesQ = useMinigames();
  const placementsQ = useMinigamePlacements();
  const { playerNumber: myPlayerNumber } = useMyPlayer();
  const [view, setView] = useState<View>('main');
  const [mode, setMode] = useState<Mode>('adjusted');
  const [expandedPlayer, setExpandedPlayer] = useState<number | null>(null);

  // --- Main tournament rows -----------------------------------------------
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
      };
    });
  }, [players.data, scores.data, activations.data]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const score =
        mode === 'adjusted'
          ? a.adjusted_to_par - b.adjusted_to_par
          : a.raw_to_par - b.raw_to_par;
      if (score !== 0) return score;
      if (a.thru !== b.thru) return b.thru - a.thru;
      return a.display_name.localeCompare(b.display_name);
    });
  }, [rows, mode]);

  const positions = useMemo(() => {
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
  }, [sorted, mode]);

  // --- Minigames rows -----------------------------------------------------
  const minigameRows: MinigameRow[] = useMemo(() => {
    if (!players.data) return [];
    const gameById = new Map(
      (minigamesQ.data ?? []).map((g) => [g.id, g]),
    );
    const byPlayer = new Map<number, MinigamePlacement[]>();
    (placementsQ.data ?? []).forEach((p) => {
      const list = byPlayer.get(p.player_number) ?? [];
      list.push(p);
      byPlayer.set(p.player_number, list);
    });

    return players.data
      .map((p) => {
        const mine = byPlayer.get(p.player_number) ?? [];
        const points = mine.reduce((acc, x) => acc + x.points, 0);
        const placements = mine
          .map((x) => {
            const game = gameById.get(x.minigame_id);
            return game ? { minigame: game, place: x.place as Place } : null;
          })
          .filter((x): x is { minigame: Minigame; place: Place } => x != null)
          .sort((a, b) =>
            a.minigame.play_order - b.minigame.play_order || a.place - b.place,
          );
        return {
          player_number: p.player_number,
          display_name: p.display_name,
          card_number: p.card_number,
          avatar_id: p.person?.avatar_id ?? null,
          points,
          placements,
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.display_name.localeCompare(b.display_name);
      });
  }, [players.data, minigamesQ.data, placementsQ.data]);

  // Current minigame leader(s) — for the 🏆 badge on the main view too.
  const trophyHolderNumbers = useMemo(() => {
    if (minigameRows.length === 0) return new Set<number>();
    const top = minigameRows[0].points;
    if (top === 0) return new Set<number>(); // nobody's placed yet
    return new Set(
      minigameRows.filter((r) => r.points === top).map((r) => r.player_number),
    );
  }, [minigameRows]);

  return (
    <section className="mx-auto flex max-w-md flex-col gap-3 px-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Leaderboard</h2>
        {view === 'main' && (
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
        )}
      </header>

      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        {(['main', 'minigames'] as View[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={[
              'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
              view === v
                ? 'bg-gold-500 text-slate-950'
                : 'text-slate-300 active:bg-slate-800',
            ].join(' ')}
          >
            {v === 'main' ? 'Main Tournament' : 'Minigames'}
          </button>
        ))}
      </div>

      {view === 'main' ? (
        <MainView
          sorted={sorted}
          positions={positions}
          mode={mode}
          myPlayerNumber={myPlayerNumber}
          trophyHolderNumbers={trophyHolderNumbers}
          loading={players.isLoading}
          onWalletTap={(pn) => navigate(`/wallet/${pn}`)}
        />
      ) : (
        <MinigamesView
          rows={minigameRows}
          loading={players.isLoading || minigamesQ.isLoading}
          myPlayerNumber={myPlayerNumber}
          trophyHolderNumbers={trophyHolderNumbers}
          expandedPlayer={expandedPlayer}
          onToggleExpand={(pn) =>
            setExpandedPlayer((cur) => (cur === pn ? null : pn))
          }
        />
      )}
    </section>
  );
}

function MainView({
  sorted,
  positions,
  mode,
  myPlayerNumber,
  trophyHolderNumbers,
  loading,
  onWalletTap,
}: {
  sorted: Row[];
  positions: string[];
  mode: Mode;
  myPlayerNumber: number | null;
  trophyHolderNumbers: Set<number>;
  loading: boolean;
  onWalletTap: (pn: number) => void;
}) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  }
  if (sorted.length === 0) {
    return (
      <p className="rounded-md border border-slate-800 bg-slate-900/60 p-4 text-center text-xs text-slate-500">
        No players yet.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {sorted.map((r, i) => {
        const score = scoreOf(r, mode);
        const isMe = r.player_number === myPlayerNumber;
        const hasTrophy = trophyHolderNumbers.has(r.player_number);
        return (
          <li key={r.player_number}>
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
                {positions[i]}
              </div>
              <Avatar
                avatarId={r.avatar_id}
                displayName={r.display_name}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm font-medium text-slate-100">
                    {r.display_name}
                  </span>
                  {hasTrophy && (
                    <span
                      aria-label="Current minigames leader"
                      title="Leading the minigames"
                      className="text-xs leading-none"
                    >
                      🏆
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-[10px] uppercase tracking-wider text-slate-500">
                  <span>Card {r.card_number}</span>
                  <span>· Thru {r.thru}</span>
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
      })}
    </ol>
  );
}

function MinigamesView({
  rows,
  loading,
  myPlayerNumber,
  trophyHolderNumbers,
  expandedPlayer,
  onToggleExpand,
}: {
  rows: MinigameRow[];
  loading: boolean;
  myPlayerNumber: number | null;
  trophyHolderNumbers: Set<number>;
  expandedPlayer: number | null;
  onToggleExpand: (pn: number) => void;
}) {
  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Loading…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-slate-800 bg-slate-900/60 p-4 text-center text-xs text-slate-500">
        No players yet.
      </p>
    );
  }

  // Tied position labels.
  const positions: string[] = [];
  let i = 0;
  while (i < rows.length) {
    const v = rows[i].points;
    let j = i + 1;
    while (j < rows.length && rows[j].points === v) j++;
    const isTie = j - i > 1;
    for (let k = i; k < j; k++) positions.push(`${isTie ? 'T' : ''}${i + 1}`);
    i = j;
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((r, idx) => {
        const isMe = r.player_number === myPlayerNumber;
        const hasTrophy = trophyHolderNumbers.has(r.player_number);
        const expanded = expandedPlayer === r.player_number;
        return (
          <li key={r.player_number}>
            <button
              type="button"
              onClick={() => onToggleExpand(r.player_number)}
              className={[
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                isMe
                  ? 'border-emerald-700/70 bg-emerald-900/15'
                  : 'border-slate-800 bg-slate-900/60 active:bg-slate-800',
              ].join(' ')}
            >
              <div className="w-7 text-center text-xs font-semibold tabular-nums text-slate-400">
                {positions[idx]}
              </div>
              <Avatar
                avatarId={r.avatar_id}
                displayName={r.display_name}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-sm font-medium text-slate-100">
                    {r.display_name}
                  </span>
                  {hasTrophy && (
                    <span aria-label="Leader" className="text-xs leading-none">
                      🏆
                    </span>
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  Card {r.card_number}
                </div>
              </div>
              <div className="text-right text-lg font-bold tabular-nums text-gold-300">
                {r.points}
                <span className="ml-0.5 text-[10px] font-normal uppercase tracking-wider text-slate-500">
                  pts
                </span>
              </div>
            </button>
            {expanded && (
              <ul className="mt-1 ml-9 flex flex-col gap-0.5 rounded-md border border-slate-800 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-300">
                {r.placements.length === 0 ? (
                  <li className="italic text-slate-500">
                    No placements yet.
                  </li>
                ) : (
                  r.placements.map(({ minigame, place }) => (
                    <li
                      key={`${minigame.id}:${place}`}
                      className="flex items-center gap-2"
                    >
                      <span aria-hidden>
                        {place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'}
                      </span>
                      <span>{minigame.display_name}</span>
                      <span className="ml-auto text-gold-500">+{4 - place}</span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
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
