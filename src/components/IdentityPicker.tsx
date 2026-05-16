import { useState } from 'react';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useMyPlayer } from '../hooks/useMyPlayer';
import Avatar from './Avatar';

/**
 * Full-screen "Who are you?" picker that fires once per phone per tournament.
 * Two-step: tap a row to select, then Confirm. Stored in localStorage by
 * useMyPlayer; no auth, no server state.
 */
export default function IdentityPicker() {
  const { setPlayer } = useMyPlayer();
  const players = useTournamentPlayers();
  const [pending, setPending] = useState<number | null>(null);

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

  const pendingPlayer =
    pending != null ? players.data.find((p) => p.player_number === pending) : null;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-5 px-4 py-8 pb-32">
      <header className="flex flex-col gap-1">
        <span className="self-start rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
          One-time
        </span>
        <h2 className="text-2xl font-semibold tracking-tight">Who are you?</h2>
        <p className="text-sm text-slate-400">
          Tap your name, then confirm. Saved to this phone — you won't have to
          do this again.
        </p>
      </header>

      {cardNumbers.map((card) => (
        <div key={card} className="flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            Card {card}
          </div>
          {(byCard.get(card) ?? []).map((p) => {
            const isPending = p.player_number === pending;
            return (
              <button
                key={p.player_number}
                type="button"
                onClick={() => setPending(p.player_number)}
                className={[
                  'flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                  isPending
                    ? 'border-gold-500 bg-gold-500/10'
                    : 'border-slate-800 bg-slate-900/60 active:bg-slate-800',
                ].join(' ')}
              >
                <Avatar
                  avatarId={p.person?.avatar_id}
                  displayName={p.display_name}
                  size={44}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={[
                      'truncate text-base font-medium',
                      isPending ? 'text-gold-300' : 'text-slate-100',
                    ].join(' ')}
                  >
                    {p.display_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    Player {p.player_number}
                    {p.is_scorekeeper && ' · Scorekeeper'}
                  </div>
                </div>
                {isPending && (
                  <span
                    aria-hidden
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-slate-950"
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}

      {/* Sticky confirm bar — appears once something is selected. */}
      {pendingPlayer && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
            <Avatar
              avatarId={pendingPlayer.person?.avatar_id}
              displayName={pendingPlayer.display_name}
              size={36}
            />
            <button
              type="button"
              onClick={() => setPlayer(pendingPlayer.player_number)}
              className="flex-1 rounded-xl bg-gold-500 px-4 py-3 text-base font-semibold text-slate-950 active:bg-gold-400"
            >
              I am {pendingPlayer.display_name}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
