import { useActiveTournament } from '../hooks/useActiveTournament';
import { useHoles } from '../hooks/useHoles';

export default function Home() {
  const tournament = useActiveTournament();
  const holes = useHoles();

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-5 py-8">
      <span className="self-start rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
        Phase 2 · Supabase
      </span>

      <h2 className="text-2xl font-semibold tracking-tight">Home</h2>
      <p className="text-sm leading-relaxed text-slate-400">
        Greeting, current course, top-3 leaderboard preview, and recent feed entries land
        here once Phase 3+ ships. For now this screen is a smoke test for the Supabase
        connection.
      </p>

      <SmokeTest label="Active tournament" state={tournament}>
        {(t) => (
          <p>
            <span className="text-slate-400">Loaded:</span>{' '}
            <span className="font-medium text-slate-100">{t.name}</span>{' '}
            <span className="text-slate-500">({t.year})</span>
          </p>
        )}
      </SmokeTest>

      <SmokeTest label="Holes" state={holes}>
        {(rows) => (
          <p>
            <span className="text-slate-400">Loaded:</span>{' '}
            <span className="font-medium text-slate-100">{rows.length}</span>{' '}
            <span className="text-slate-500">/ 54 expected</span>
          </p>
        )}
      </SmokeTest>
    </section>
  );
}

interface SmokeTestState<T> {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
}

function formatError(err: unknown): string {
  if (err == null) return '';
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    // Supabase errors are plain objects: { message, code, details, hint }
    const e = err as Record<string, unknown>;
    const parts = [
      e.message && `message: ${String(e.message)}`,
      e.code && `code: ${String(e.code)}`,
      e.details && `details: ${String(e.details)}`,
      e.hint && `hint: ${String(e.hint)}`,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join('\n');
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function SmokeTest<T>({
  label,
  state,
  children,
}: {
  label: string;
  state: SmokeTestState<T>;
  children: (data: T) => React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      {state.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {state.error != null && (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-rose-400">
          {formatError(state.error)}
        </pre>
      )}
      {state.data != null && <div className="text-sm">{children(state.data)}</div>}
    </div>
  );
}
