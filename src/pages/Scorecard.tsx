import { useMemo, useState } from 'react';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { useHoles } from '../hooks/useHoles';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useScores } from '../hooks/useScores';
import { useMyPlayer } from '../hooks/useMyPlayer';
import Avatar from '../components/Avatar';
import ScoreEntrySheet from '../components/ScoreEntrySheet';
import { categorize, cellClasses, formatToPar } from '../lib/scoring';
import type { CourseId, Hole, Score } from '../types/database';
import type { TournamentPlayerWithPerson } from '../hooks/useTournamentPlayers';

const COURSE_ORDER: CourseId[] = ['seven_oaks', 'crockett', 'cedar_hill'];
const COURSE_LABEL: Record<CourseId, string> = {
  seven_oaks: 'Seven Oaks',
  crockett: 'Crockett',
  cedar_hill: 'Cedar Hill',
};

export default function Scorecard() {
  const tournament = useActiveTournament();
  const holes = useHoles();
  const players = useTournamentPlayers();
  const scores = useScores();
  const { playerNumber: myPlayerNumber } = useMyPlayer();

  const me = useMemo(
    () => players.data?.find((p) => p.player_number === myPlayerNumber) ?? null,
    [players.data, myPlayerNumber],
  );

  const [courseId, setCourseId] = useState<CourseId>('seven_oaks');
  const [cardNumber, setCardNumber] = useState<number | null>(null);
  const [entry, setEntry] = useState<{
    player: TournamentPlayerWithPerson;
    hole: Hole;
  } | null>(null);

  // Default card_number to my card once players load.
  const activeCard = cardNumber ?? me?.card_number ?? 1;

  // Distinct card numbers in this tournament (1, 1+2, or 1+2+3).
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

  // Index scores by (player_number, hole_id) for O(1) lookups.
  const scoresByKey = useMemo(() => {
    const map = new Map<string, Score>();
    (scores.data ?? []).forEach((s) => {
      map.set(`${s.player_number}:${s.hole_id}`, s);
    });
    return map;
  }, [scores.data]);

  const isMyCard = me?.card_number === activeCard;
  const canEdit = !!me?.is_scorekeeper && isMyCard;

  if (tournament.isLoading || players.isLoading || holes.isLoading) {
    return <CenteredMessage>Loading scorecard…</CenteredMessage>;
  }

  return (
    <section className="flex flex-col gap-3 px-3 py-4">
      <CourseTabs value={courseId} onChange={setCourseId} />

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

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900 px-2 py-2 text-left text-[10px] uppercase tracking-wider text-slate-500">
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
              const totalToPar = playerScores.reduce((acc, s, i) => {
                if (!s) return acc;
                return acc + (s.strokes - courseHoles[i].par);
              }, 0);
              return (
                <tr key={p.player_number} className="border-t border-slate-800">
                  <th className="sticky left-0 z-10 bg-slate-900 px-2 py-1.5 text-left">
                    <div className="flex items-center gap-2">
                      <Avatar
                        avatarId={p.person?.avatar_id}
                        displayName={p.display_name}
                        size={28}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-slate-100">
                          {p.display_name}
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
                    const strokes = score?.strokes ?? null;
                    const category =
                      strokes != null ? categorize(strokes, h.par) : null;
                    return (
                      <td
                        key={h.id}
                        className="min-w-9 px-1 py-1.5 text-center"
                      >
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setEntry({ player: p, hole: h })}
                          className={[
                            'flex h-8 w-8 items-center justify-center rounded-md text-sm tabular-nums transition-colors',
                            strokes != null
                              ? cellClasses(category!)
                              : 'text-slate-700',
                            canEdit && 'active:bg-slate-800',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {strokes ?? '–'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {totalStrokes === 0 ? (
                      <span className="text-slate-600">–</span>
                    ) : (
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-slate-100">{totalStrokes}</span>
                        <span className="text-[10px] text-slate-400">
                          {formatToPar(totalToPar)}
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

      {entry && tournament.data && me && (
        <ScoreEntrySheet
          tournament_id={tournament.data.id}
          player={entry.player}
          hole={entry.hole}
          currentStrokes={
            scoresByKey.get(`${entry.player.player_number}:${entry.hole.id}`)
              ?.strokes ?? null
          }
          enteredByPlayerNumber={me.player_number}
          onClose={() => setEntry(null)}
        />
      )}
    </section>
  );
}

function CourseTabs({
  value,
  onChange,
}: {
  value: CourseId;
  onChange: (v: CourseId) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
      {COURSE_ORDER.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={[
            'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
            value === c
              ? 'bg-gold-500 text-slate-950'
              : 'text-slate-300 active:bg-slate-800',
          ].join(' ')}
        >
          {COURSE_LABEL[c]}
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
