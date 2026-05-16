import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import TopNav from './components/nav/TopNav';
import BottomNav from './components/nav/BottomNav';
import Home from './pages/Home';
import Scorecard from './pages/Scorecard';
import MyRound from './pages/MyRound';
import Leaderboard from './pages/Leaderboard';
import Feed from './pages/Feed';
import Setup from './pages/Setup';
import { useActiveTournament } from './hooks/useActiveTournament';

export default function App() {
  const tournament = useActiveTournament();
  const location = useLocation();
  const onSetup = location.pathname === '/setup';

  // Setup is full-screen — no top/bottom nav until the tournament is live.
  if (tournament.data && !tournament.data.setup_complete) {
    if (!onSetup) return <Navigate to="/setup" replace />;
    return (
      <div className="flex h-full flex-col">
        <main className="flex-1 overflow-y-auto">
          <Setup />
        </main>
      </div>
    );
  }

  // Setup is done — keep the user out of /setup unless they reset it.
  if (tournament.data?.setup_complete && onSetup) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-full flex-col">
      <TopNav />
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scorecard" element={<Scorecard />} />
          <Route path="/my-round" element={<MyRound />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
