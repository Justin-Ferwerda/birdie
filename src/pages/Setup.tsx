import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { usePeople } from '../hooks/usePeople';
import { useStartTournament, type SetupPlayer } from '../hooks/useStartTournament';

type CardNumber = 1 | 2 | 3;
type FormPlayer = { name: string; card_number: CardNumber; is_scorekeeper: boolean };

const emptyPlayer = (): FormPlayer => ({
  name: '',
  card_number: 1,
  is_scorekeeper: false,
});

/** Distribute 12 indexes into three groups of 4 with random card assignments. */
function shuffleCards(): CardNumber[] {
  const buckets: CardNumber[] = [
    1, 1, 1, 1,
    2, 2, 2, 2,
    3, 3, 3, 3,
  ];
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

  const [players, setPlayers] = useState<FormPlayer[]>(() =>
    Array.from({ length: 12 }, emptyPlayer),
  );

  const updatePlayer = (idx: number, patch: Partial<FormPlayer>) => {
    setPlayers((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const handleShuffle = () => {
    const cards = shuffleCards();
    setPlayers((prev) =>
      prev.map((p, i) => ({ ...p, card_number: cards[i], is_scorekeeper: false })),
    );
  };

  const handleSetScorekeeper = (idx: number) => {
    setPlayers((prev) =>
      prev.map((p, i) => {
        if (i === idx) return { ...p, is_scorekeeper: !p.is_scorekeeper };
        // Only one scorekeeper per card — clear others on the same card.
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

  // --- Validation -----------------------------------------------------------
  const validation = useMemo(() => {
    const trimmedNames = players.map((p) => p.name.trim());

    const allFilled = trimmedNames.every((n) => n.length > 0);

    const lowered = trimmedNames.map((n) => n.toLowerCase());
    const dupeNames = new Set<string>();
    lowered.forEach((n, i) => {
      if (n && lowered.indexOf(n) !== i) dupeNames.add(n);
    });

    const cardCounts: Record<CardNumber, number> = { 1: 0, 2: 0, 3: 0 };
    const cardScorekeepers: Record<CardNumber, number> = { 1: 0, 2: 0, 3: 0 };
    players.forEach((p) => {
      cardCounts[p.card_number]++;
      if (p.is_scorekeeper) cardScorekeepers[p.card_number]++;
    });

    const cardsBalanced = ([1, 2, 3] as CardNumber[]).every((c) => cardCounts[c] === 4);
    const scorekeepersOk = ([1, 2, 3] as CardNumber[]).every(
      (c) => cardScorekeepers[c] === 1,
    );

    return {
      allFilled,
      duplicateNames: dupeNames,
      cardCounts,
      cardScorekeepers,
      cardsBalanced,
      scorekeepersOk,
      canSubmit: allFilled && dupeNames.size === 0 && cardsBalanced && scorekeepersOk,
    };
  }, [players]);

  // --- Submit ---------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.canSubmit || !tournament.data) return;

    const peopleByLowerName = new Map(
      (people.data ?? []).map((p) => [p.display_name.trim().toLowerCase(), p.id]),
    );

    const payload: SetupPlayer[] = players.map((p) => {
      const trimmed = p.name.trim();
      const existing = peopleByLowerName.get(trimmed.toLowerCase());
      return {
        name: trimmed,
        card_number: p.card_number,
        is_scorekeeper: p.is_scorekeeper,
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
          12 players, 3 cards of 4, 1 scorekeeper per card.
        </p>
      </header>

      <button
        type="button"
        onClick={handleShuffle}
        className="self-start rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 active:bg-slate-700"
      >
        🎲 Shuffle cards
      </button>

      {/* Autocomplete source — empty in 2026 since no people exist yet. */}
      <datalist id="people-list">
        {(people.data ?? []).map((p) => (
          <option key={p.id} value={p.display_name} />
        ))}
      </datalist>

      <ol className="flex flex-col gap-2">
        {players.map((p, idx) => (
          <li
            key={idx}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 text-center text-xs font-medium text-slate-500">
                {idx + 1}
              </span>
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

            <div className="mt-2 flex items-center justify-between gap-2 pl-8">
              <div className="flex gap-1">
                {([1, 2, 3] as CardNumber[]).map((c) => (
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
          </li>
        ))}
      </ol>

      <CardSummary
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
    </form>
  );
}

function CardSummary({
  cardCounts,
  cardScorekeepers,
}: {
  cardCounts: Record<CardNumber, number>;
  cardScorekeepers: Record<CardNumber, number>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {([1, 2, 3] as CardNumber[]).map((c) => {
        const ok = cardCounts[c] === 4 && cardScorekeepers[c] === 1;
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
            <div>{cardCounts[c]}/4 players</div>
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
