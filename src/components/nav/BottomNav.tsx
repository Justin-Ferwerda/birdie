import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/scorecard', label: 'Scorecard', icon: '📋' },
  { to: '/my-round', label: 'My Round', icon: '🥏' },
  { to: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
  { to: '/feed', label: 'Feed', icon: '📰' },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-900/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                [
                  'flex flex-col items-center justify-center gap-1 py-2 text-[11px]',
                  isActive ? 'text-gold-500' : 'text-slate-400',
                ].join(' ')
              }
            >
              <span aria-hidden className="text-lg leading-none">
                {icon}
              </span>
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
