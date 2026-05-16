import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { usePeople } from '../hooks/usePeople';
import { useStartTournament, type SetupPlayer } from '../hooks/useStartTournament';
import Avatar from '../components/Avatar';
import AvatarPicker from '../components/AvatarPicker';

type CardNumber = 1 | 2 | 3;
type CourseId = 'seven_oaks' | 'crockett' | 'cedar_hill';
type FormPlayer = {
  name: string;
  card_number: CardNumber;
  is_scorekeeper: boolean;
  avatar_id: string | null;
  /** null = all 3. Set to a subset for guests. */
  allowed_courses: CourseId[] | null;
};

const MIN_PLAYERS = 6;
const MAX_PLAYERS = 12;

const ALL_COURSES: CourseId[] = ['seven_oaks', 'crockett', 'cedar_hill'];
const COURSE_LABEL: Record<CourseId, string> = {
  seven_oaks: 'SO',
  crockett: 'CR',
  cedar_hill: 'CH',
};

const emptyPlayer = (): FormPlayer => ({
  name: '',
  card_number: 1,
  is_scorekeeper: false,
  avatar_id: null,
  allowed_courses: null,
});

const defaultCardCount = (playerCount: number): CardNumber =>
  Math.min(3, Math.max(1, Math.ceil(playerCount / 4))) as CardNumber;

/** Distribute `playerCount` indexes as evenly as possible across `cardCount` cards. */
function shuffleCards(playerCount: number, cardCount: CardNumber): CardNumber[] {
  const buckets: CardNumber[] = [];
  for (let i = 0; i < playerCount; i++) {
    buckets.push(((i % cardCount) + 1) as CardNumber);
  }
  for (let i = buckets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [buckets[i], buckets[j]] = [buckets[j], buckets[i]];
  }
  return buckets;
}

export default function Setup() {
  const navigate = useNavigate();
  const tournament = useActiveTournament();
  const people = usePeople();
  const startTournament = useStartTournament();

  const [playerCount, setPlayerCount] = useState<number>(MAX_PLAYERS);
  const [cardCount, setCardCount] = useState<CardNumber>(defaultCardCount(MAX_PLAYERS));
  const [players, setPlayers] = useState<FormPlayer[]>(() =>
    Array.from({ length: MAX_PLAYERS }, emptyPlayer),
  );
  const [pickerForIdx, setPickerForIdx] = useState<number | null>(null);

  const activePlayers = players.slice(0, playerCount);

  const takenAvatars = useMemo(
    () =>
      new Set(
        activePlayers
          .map((p) => p.avatar_id)
          .filter((id): id is string => id != null),
      ),
    [activePlayers],
  );

  const changePlayerCount = (next: number) => {
    const clamped = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, next));
    setPlayerCount(clamped);
    // Re-derive a sensible card count, but don't override if the user already
    // picked something compatible.
    const suggested = defaultCardCount(clamped);
    if (suggested !== cardCount) setCardCount(suggested);
  };

  const changeCardCount = (next: CardNumber) => {
    setCardCount(next);
    // Snap any player on a now-unused card down to card 1, and clear their
    // scorekeeper flag so the user re-picks.
    setPlayers((prev) =>
      prev.map((p) =>
        p.card_number > next
          ? { ...p, card_number: 1, is_scorekeeper: false }
          : p,
      ),
    );
  };

  const updatePlayer = (idx: number, patch: Partial<FormPlayer>) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const handleShuffle = () => {
    const cards = shuffleCards(playerCount, cardCount);
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i >= playerCount) return p;
        return { ...p, card_number: cards[i], is_scorekeeper: false };
      }),
    );
  };

  const handleSetScorekeeper = (idx: number) => {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i === idx) return { ...p, is_scorekeeper: !p.is_scorekeeper };
        if (p.card_number === prev[idx].card_number && p.is_scorekeeper) {
          return { ...p, is_scorekeeper: false };
        }
        return p;
      }),
    );
  };

  const handleCardChange = (idx: number, card_number: CardNumber) => {
    setPlayers((prev) =>
      prev.map((p, i) =>
        i === idx ? { ...p, card_number, is_scorekeeper: false } : p,
      ),
    );
  };

  const toggleCourse = (idx: number, course: CourseId) => {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const current = p.allowed_courses ?? [...ALL_COURSES];
        const has = current.includes(course);
        let next: CourseId[];
        if (has) {
          next = current.filter((c) => c !== course);
        } else {
          // Preserve play-order to keep arrays stable.
          next = ALL_COURSES.filter((c) => current.includes(c) || c === course);
        }
        // Don't allow zero — a player must play at least one course.
        if (next.length === 0) return p;
        return {
          ...p,
          allowed_courses: next.length === ALL_COURSES.length ? null : next,
        };
      }),
    );
  };

  // --- Validation -----------------------------------------------------------
  const validation = useMemo(() => {
    const trimmedNames = activePlayers.map((p) => p.name.trim());
    const allFilled = trimmedNames.every((n) => n.length > 0);

    const lowered = trimmedNames.map((n) => n.toLowerCase());
    const dupeNames = new Set<string>();
    lowered.forEach((n, i) => {
      if (n && lowered.indexOf(n) !== i) dupeNames.add(n);
    });

    const cards = Array.from({ length: cardCount }, (_, i) => (i + 1) as CardNumber);
    const cardCounts: Record<number, number> = {};
    const cardScorekeepers: Record<number, number> = {};
    cards.forEach((c) => {
      cardCounts[c] = 0;
      cardScorekeepers[c] = 0;
    });
    activePlayers.forEach((p) => {
      if (p.card_number <= cardCount) {
        cardCounts[p.card_number]++;
        if (p.is_scorekeeper) cardScorekeepers[p.card_number]++;
      }
    });

    const everyCardHasAtLeastOne = cards.every((c) => cardCounts[c] >= 1);
    const scorekeepersOk = cards.every((c) => cardScorekeepers[c] === 1);

    return {
      cards,
      allFilled,
      duplicateNames: dupeNames,
      cardCounts,
      cardScorekeepers,
      everyCardHasAtLeastOne,
      scorekeepersOk,
      canSubmit:
        allFilled &&
        dupeNames.size === 0 &&
        everyCardHasAtLeastOne &&
        scorekeepersOk,
    };
  }, [activePlayers, cardCount]);

  // --- Submit ---------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.canSubmit || !tournament.data) return;

    const peopleByLowerName = new Map(
      (people.data ?? []).map((p) => [p.display_name.trim().toLowerCase(), p.id]),
    );

    const payload: SetupPlayer[] = activePlayers.map((p) => {
      const trimmed = p.name.trim();
      const existing = peopleByLowerName.get(trimmed.toLowerCase());
      return {
        name: trimmed,
        card_number: p.card_number,
        is_scorekeeper: p.is_scorekeeper,
        avatar_id: p.avatar_id,
        // Null = all 3; only persist a subset when the user actually restricted.
        allowed_courses:
          p.allowed_courses == null || p.allowed_courses.length === ALL_COURSES.length
            ? null
            : p.allowed_courses,
        existing_person_id: existing,
      };
    });

    try {
      await startTournament.mutateAsync({
        tournament_id: tournament.data.id,
        players: payload,
      });
      toast.success('Tournament started — birdie season is open.');
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not start tournament: ${msg}`);
    }
  };

  if (tournament.isLoading) return <CenteredMessage>Loading tournament…</CenteredMessage>;
  if (tournament.error || !tournament.data) {
    return <CenteredMessage>Could not load the active tournament.</CenteredMessage>;
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
      <header className="flex flex-col gap-1">
        <span className="self-start rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
          Setup
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">Set up the tournament</h2>
        <p className="text-sm text-slate-400">
          Pick the player count and how many cards. Each card needs at least one
          player and exactly one scorekeeper.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Counter
          label="Players"
          value={playerCount}
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          onChange={changePlayerCount}
        />
        <CardCountPicker value={cardCount} onChange={changeCardCount} />
      </div>

      <button
        type="button"
        onClick={handleShuffle}
        className="self-start rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 active:bg-slate-700"
      >
        🎲 Shuffle cards
      </button>

      <datalist id="people-list">
        {(people.data ?? []).map((p) => (
          <option key={p.id} value={p.display_name} />
        ))}
      </datalist>

      <ol className="flex flex-col gap-2">
        {activePlayers.map((p, idx) => (
          <li
            key={idx}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 text-center text-xs font-medium text-slate-500">
                {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => setPickerForIdx(idx)}
                className="rounded-full transition-transform active:scale-95"
                aria-label="Pick avatar"
              >
                <Avatar avatarId={p.avatar_id} displayName={p.name} size={40} />
              </button>
              <input
                type="text"
                list="people-list"
                placeholder="Player name"
                value={p.name}
                onChange={(e) => updatePlayer(idx, { name: e.target.value })}
                autoCapitalize="words"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 placeholder-slate-600 outline-none focus:border-gold-500"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex gap-1">
                {validation.cards.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCardChange(idx, c)}
                    className={[
                      'h-8 w-8 rounded-md text-sm font-medium transition-colors',
                      p.card_number === c
                        ? 'bg-gold-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 active:bg-slate-700',
                    ].join(' ')}
                    aria-label={`Card ${c}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleSetScorekeeper(idx)}
                className={[
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  p.is_scorekeeper
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 active:bg-slate-700',
                ].join(' ')}
              >
                {p.is_scorekeeper ? '✓ Scorekeeper' : 'Scorekeeper'}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
              <span>Plays</span>
              <div className="flex gap-1">
                {ALL_COURSES.map((c) => {
                  const playing =
                    p.allowed_courses == null || p.allowed_courses.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCourse(idx, c)}
                      className={[
                        'h-6 rounded px-1.5 text-[10px] font-semibold transition-colors',
                        playing
                          ? 'bg-gold-500 text-slate-950'
                          : 'bg-slate-800 text-slate-500',
                      ].join(' ')}
                    >
                      {COURSE_LABEL[c]}
                    </button>
                  );
                })}
              </div>
              {p.allowed_courses != null &&
                p.allowed_courses.length < ALL_COURSES.length && (
                  <span className="text-slate-400">
                    · guest ({p.allowed_courses.length}/3)
                  </span>
                )}
            </div>
          </li>
        ))}
      </ol>

      <CardSummary
        cards={validation.cards}
        cardCounts={validation.cardCounts}
        cardScorekeepers={validation.cardScorekeepers}
      />

      {validation.duplicateNames.size > 0 && (
        <p className="text-sm text-rose-400">
          Duplicate name(s): {Array.from(validation.duplicateNames).join(', ')}
        </p>
      )}

      <button
        type="submit"
        disabled={!validation.canSubmit || startTournament.isPending}
        className="rounded-xl bg-gold-500 px-4 py-3 text-base font-semibold text-slate-950 transition-colors disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
      >
        {startTournament.isPending ? 'Starting…' : 'Start Tournament'}
      </button>

      {pickerForIdx !== null && (
        <AvatarPicker
          selected={players[pickerForIdx]?.avatar_id ?? null}
          taken={takenAvatars}
          onPick={(avatar_id) => updatePlayer(pickerForIdx, { avatar_id })}
          onClose={() => setPickerForIdx(null)}
        />
      )}
    </form>
  );
}

function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          className="h-8 w-8 rounded-md bg-slate-800 text-lg text-slate-200 disabled:opacity-40"
        >
          −
        </button>
        <span className="flex-1 text-center text-lg font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          className="h-8 w-8 rounded-md bg-slate-800 text-lg text-slate-200 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function CardCountPicker({
  value,
  onChange,
}: {
  value: CardNumber;
  onChange: (v: CardNumber) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-slate-500">Cards</span>
      <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        {([1, 2, 3] as CardNumber[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={[
              'h-9 flex-1 rounded-md text-sm font-medium transition-colors',
              value === c
                ? 'bg-gold-500 text-slate-950'
                : 'text-slate-300 active:bg-slate-800',
            ].join(' ')}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardSummary({
  cards,
  cardCounts,
  cardScorekeepers,
}: {
  cards: CardNumber[];
  cardCounts: Record<number, number>;
  cardScorekeepers: Record<number, number>;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
    >
      {cards.map((c) => {
        const ok = cardCounts[c] >= 1 && cardScorekeepers[c] === 1;
        return (
          <div
            key={c}
            className={[
              'rounded-lg border p-2 text-center text-xs',
              ok
                ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200'
                : 'border-slate-800 bg-slate-900/40 text-slate-400',
            ].join(' ')}
          >
            <div className="text-sm font-medium">Card {c}</div>
            <div>
              {cardCounts[c]} player{cardCounts[c] === 1 ? '' : 's'}
            </div>
            <div>{cardScorekeepers[c]}/1 scorekeeper</div>
          </div>
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
