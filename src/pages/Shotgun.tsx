import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useFireShotgun } from '../hooks/useFireShotgun';
import Avatar from '../components/Avatar';

export default function Shotgun() {
  const navigate = useNavigate();
  const tournament = useActiveTournament();
  const players = useTournamentPlayers();
  const fireShotgun = useFireShotgun();

  const [participants, setParticipants] = useState<Set<number>>(new Set());
  const [fastest, setFastest] = useState<number | null>(null);

  const fired = tournament.data?.shotgun_fired ?? false;

  const sortedPlayers = useMemo(
    () =>
      (players.data ?? [])
        .slice()
        .sort((a, b) =>
          a.card_number - b.card_number !== 0
            ? a.card_number - b.card_number
            : a.player_number - b.player_number,
        ),
    [players.data],
  );

  const toggle = (n: number) =>
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(n)) {
        next.delete(n);
        if (fastest === n) setFastest(null);
      } else {
        next.add(n);
      }
      return next;
    });

  const canSubmit =
    !fired &&
    !fireShotgun.isPending &&
    participants.size >= 1 &&
    fastest != null &&
    participants.has(fastest);

  const handleSubmit = async () => {
    if (!canSubmit || !tournament.data || fastest == null) return;
    const fastestName = sortedPlayers.find(
      (p) => p.player_number === fastest,
    )?.display_name;
    try {
      await fireShotgun.mutateAsync({
        tournament_id: tournament.data.id,
        participants: Array.from(participants),
        fastest_player_number: fastest,
        fastest_display_name: fastestName,
      });
      toast.success(`🍺 The Shotgun is fired — ${fastestName} took it home`);
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not fire: ${msg}`);
    }
  };

  if (fired) {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-3 px-4 py-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          🍺 The Shotgun has fired
        </h2>
        <p className="text-sm text-slate-400">
          Bonuses apply on each participant's next Crockett hole. Nothing more
          to do here.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="self-start rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-200"
        >
          ← Back to home
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 pb-32">
      <header className="flex flex-col gap-1">
        <span className="self-start rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
          One-shot · Crockett
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">🍺 The Shotgun</h2>
        <p className="text-sm leading-relaxed text-slate-400">
          Check everyone who's racing. Pick the fastest finisher. On their
          next Crockett hole, participants get <span className="text-gold-400">–1</span>{' '}
          and the fastest gets <span className="text-gold-400">–3</span>. Fires
          once for the whole tournament — pick carefully.
        </p>
      </header>

      <ol className="flex flex-col gap-2">
        {sortedPlayers.map((p) => {
          const isIn = participants.has(p.player_number);
          const isFastest = fastest === p.player_number;
          return (
            <li
              key={p.player_number}
              className={[
                'flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
                isFastest
                  ? 'border-gold-500 bg-gold-500/10'
                  : isIn
                    ? 'border-slate-700 bg-slate-900/80'
                    : 'border-slate-800 bg-slate-900/40',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => toggle(p.player_number)}
                className="flex flex-1 items-center gap-3 text-left"
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={isIn}
                  aria-label={`${p.display_name} participated`}
                  className="h-5 w-5 accent-gold-500"
                />
                <Avatar
                  avatarId={p.person?.avatar_id}
                  displayName={p.display_name}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-100">
                    {p.display_name}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Card {p.card_number}
                  </div>
                </div>
              </button>
              <button
                type="button"
                disabled={!isIn}
                onClick={() => setFastest(p.player_number)}
                className={[
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  isFastest
                    ? 'border-gold-500 bg-gold-500 text-slate-950'
                    : isIn
                      ? 'border-slate-700 bg-slate-900 text-slate-300 active:bg-slate-800'
                      : 'border-slate-800 bg-slate-900/40 text-slate-700',
                ].join(' ')}
              >
                {isFastest ? '🥇 Fastest' : 'Mark fastest'}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md flex-col gap-2 px-4 py-3">
          <div className="text-xs text-slate-400">
            {participants.size} in
            {fastest != null && ` · fastest set`}
            {!canSubmit && (
              <span className="ml-1 text-slate-500">
                {participants.size === 0
                  ? '— pick at least one'
                  : fastest == null
                    ? '— pick a fastest'
                    : ''}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-md bg-slate-800 px-3 py-3 text-sm text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 rounded-xl bg-gold-500 px-4 py-3 text-base font-semibold text-slate-950 disabled:opacity-50"
            >
              {fireShotgun.isPending ? 'Firing…' : 'Lock it in'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
