import { Link } from 'react-router-dom';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { useTournamentPlayers } from '../hooks/useTournamentPlayers';
import { useMyPlayer } from '../hooks/useMyPlayer';
import Avatar from '../components/Avatar';

export default function Home() {
  const tournament = useActiveTournament();
  const players = useTournamentPlayers();
  const { playerNumber } = useMyPlayer();

  const me = players.data?.find((p) => p.player_number === playerNumber) ?? null;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-5 px-4 py-6">
      {me && (
        <header className="flex items-center gap-3">
          <Avatar avatarId={me.person?.avatar_id} displayName={me.display_name} size={56} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              {tournament.data?.name ?? 'Tournament'}
            </div>
            <div className="truncate text-xl font-semibold">
              Hey, {me.display_name.split(' ')[0]}.
            </div>
            <div className="text-xs text-slate-400">
              Card {me.card_number}
              {me.is_scorekeeper && ' · Scorekeeper'}
            </div>
          </div>
        </header>
      )}

      <Link
        to="/scorecard"
        className="rounded-2xl bg-gold-500 px-5 py-5 text-center text-lg font-semibold text-slate-950 active:bg-gold-400"
      >
        Enter scores
      </Link>

      <p className="text-xs text-slate-500">
        Leaderboard, feed, and per-round stats fill in as later phases ship.
      </p>
    </section>
  );
}
