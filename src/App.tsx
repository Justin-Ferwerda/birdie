import { Routes, Route, Navigate } from 'react-router-dom';
import TopNav from './components/nav/TopNav';
import BottomNav from './components/nav/BottomNav';
import Home from './pages/Home';
import Scorecard from './pages/Scorecard';
import MyRound from './pages/MyRound';
import Leaderboard from './pages/Leaderboard';
import Feed from './pages/Feed';

export default function App() {
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
