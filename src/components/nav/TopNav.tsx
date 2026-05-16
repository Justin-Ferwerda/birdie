export default function TopNav() {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur">
      <h1 className="text-base font-semibold tracking-tight">
        <span className="text-gold-500">Birdie</span> for Shurdy
      </h1>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>Pre-tournament</span>
        <span
          className="inline-block h-2 w-2 rounded-full bg-emerald-500"
          aria-label="Connection status"
        />
      </div>
    </header>
  );
}
