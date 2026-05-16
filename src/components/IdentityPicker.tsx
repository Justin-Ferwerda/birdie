import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useMyPlayer } from '../hooks/useMyPlayer';
import Avatar from './Avatar';

/**
 * Full-screen "Who are you?" picker that fires once per phone per tournament.
 * Stored in localStorage by useMyPlayer; no auth, no server state.
 */
export default function IdentityPicker() {
  const { setPlayer } = useMyPlayer();
  const players = useTournamentPlayers();

  if (players.isLoading || !players.data) {
    return (
      <section className="flex h-full items-center justify-center p-6 text-sm text-slate-400">
        Loading players…
      </section>
    );
  }

  // Group by card for a friendlier layout.
  const byCard = new Map<number, typeof players.data>();
  players.data.forEach((p) => {
    const list = byCard.get(p.card_number) ?? [];
    list.push(p);
    byCard.set(p.card_number, list);
  });
  const cardNumbers = Array.from(byCard.keys()).sort();

  return (
    <section className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <span className="self-start rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
          One-time
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">Who are you?</h2>
        <p className="text-sm text-slate-400">
          Tap your name. Saved to this phone — you won't have to do this again.
        </p>
      </header>

      {cardNumbers.map((card) => (
        <div key={card} className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            Card {card}
          </div>
          {(byCard.get(card) ?? []).map((p) => (
            <button
              key={p.player_number}
              type="button"
              onClick={() => setPlayer(p.player_number)}
              className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-left active:bg-slate-800"
            >
              <Avatar avatarId={p.person?.avatar_id} displayName={p.display_name} size={44} />
              <div className="flex-1 min-w-0">
                <div className="truncate text-base font-medium text-slate-100">
                  {p.display_name}
                </div>
                <div className="text-xs text-slate-500">
                  Player {p.player_number}
                  {p.is_scorekeeper && ' · Scorekeeper'}
                </div>
              </div>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
