import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import TopNav from './components/nav/TopNav';
import BottomNav from './components/nav/BottomNav';
import Home from './pages/Home';
import Scorecard from './pages/Scorecard';
import MyRound from './pages/MyRound';
import Leaderboard from './pages/Leaderboard';
import Feed from './pages/Feed';
import Setup from './pages/Setup';
import RuleWallet from './pages/RuleWallet';
import IdentityPicker from './components/IdentityPicker';
import RealtimeListener from './components/RealtimeListener';
import { useActiveTournament } from './hooks/useActiveTournament';
import { useMyPlayer } from './hooks/useMyPlayer';

export default function App() {
  const tournament = useActiveTournament();
  const { playerNumber } = useMyPlayer();
  const location = useLocation();
  const onSetup = location.pathname === '/setup';

  // Setup is full-screen — no nav until the tournament is live.
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

  if (tournament.data?.setup_complete && onSetup) {
    return <Navigate to="/" replace />;
  }

  // Setup is done but this phone hasn't picked an identity yet.
  if (tournament.data?.setup_complete && playerNumber == null) {
    return (
      <div className="flex h-full flex-col">
        <TopNav />
        <main className="flex-1 overflow-y-auto pb-20">
          <IdentityPicker />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <RealtimeListener />
      <TopNav />
      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scorecard" element={<Scorecard />} />
          <Route path="/my-round" element={<MyRound />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/wallet/:playerNumber" element={<RuleWallet />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
