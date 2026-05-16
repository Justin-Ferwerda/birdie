import { useMemo, useState } from 'react';
import { useActivityEvents } from '../hooks/useActivityEvents';
import type { ActivityEvent, ActivityEventType } from '../types/database';

type Filter = 'all' | 'birdies' | 'rules' | 'events';

const FILTER_LABEL: Record<Filter, string> = {
  all: 'All',
  birdies: 'Birdies+',
  rules: 'Rules',
  events: 'Big',
};

const BIRDIE_PLUS: ReadonlySet<ActivityEventType> = new Set([
  'ace',
  'eagle',
  'birdie',
  'exclusive_ace',
  'exclusive_eagle',
  'exclusive_birdie',
]);

const BIG_EVENTS: ReadonlySet<ActivityEventType> = new Set([
  'shotgun_event',
  'classic_failed',
  'hardest_hole',
  'easiest_hole',
  'putter_sabotage_target',
  'exclusive_ace',
  'exclusive_eagle',
  'exclusive_birdie',
]);

function matches(event: ActivityEvent, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'birdies') return BIRDIE_PLUS.has(event.event_type);
  if (filter === 'rules') return event.event_type === 'rule_activation';
  if (filter === 'events') return BIG_EVENTS.has(event.event_type);
  return false;
}

export default function Feed() {
  const events = useActivityEvents();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () => (events.data ?? []).filter((e) => matches(e, filter)),
    [events.data, filter],
  );

  return (
    <section className="mx-auto flex max-w-md flex-col gap-3 px-4 py-4">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Activity</h2>
      </header>

      <div className="flex gap-1.5">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-gold-500 bg-gold-500/10 text-gold-300'
                  : 'border-slate-800 bg-slate-900 text-slate-400 active:bg-slate-800',
              ].join(' ')}
            >
              {FILTER_LABEL[f]}
            </button>
          );
        })}
      </div>

      {events.isLoading && (
        <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
      )}

      {!events.isLoading && filtered.length === 0 && (
        <p className="rounded-md border border-slate-800 bg-slate-900/60 p-4 text-center text-xs text-slate-500">
          Nothing here yet. Birdies, rules, and big moments will land here as
          they happen.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {filtered.map((e) => (
          <FeedEntry key={e.id} event={e} />
        ))}
      </ul>
    </section>
  );
}

function FeedEntry({ event }: { event: ActivityEvent }) {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const name = (p.player_display_name as string | undefined) ?? `Player ${event.player_number ?? '?'}`;
  const hole = p.hole_number as number | undefined;
  const holeSuffix = hole != null ? ` · H${hole}` : '';
  const accent = accentForType(event.event_type);

  let icon = '·';
  let text = '';
  switch (event.event_type) {
    case 'ace':
      icon = '🥇';
      text = `${name} ACE${holeSuffix}`;
      break;
    case 'eagle':
      icon = '🦅';
      text = `${name} eagled${holeSuffix}`;
      break;
    case 'birdie':
      icon = '🐦';
      text = `${name} birdied${holeSuffix}`;
      break;
    case 'double_bogey_or_worse':
      icon = '💀';
      text = `${name} ${p.strokes ?? '?'}${holeSuffix}`;
      break;
    case 'rule_activation':
      icon = (p.rule_emoji as string | undefined) ?? '•';
      text = `${name} — ${(p.rule_display_name as string | undefined) ?? 'a rule'}${holeSuffix}`;
      break;
    case 'shotgun_event':
      icon = '🍺';
      text = `${name} survived The Shotgun`;
      break;
    case 'classic_failed':
      icon = '👖';
      text = `${name} failed The Classic`;
      break;
    case 'exclusive_ace':
      icon = '✨';
      text = `Only ${name} aced${holeSuffix}`;
      break;
    case 'exclusive_eagle':
      icon = '✨';
      text = `Only ${name} eagled${holeSuffix}`;
      break;
    case 'exclusive_birdie':
      icon = '✨';
      text = `Only ${name} birdied${holeSuffix}`;
      break;
    case 'hardest_hole':
      icon = '🔥';
      text = `Hardest hole — ${event.hole_id}`;
      break;
    case 'easiest_hole':
      icon = '🍃';
      text = `Easiest hole — ${event.hole_id}`;
      break;
    case 'putter_sabotage_target':
      icon = '🎯';
      text = `${(p.primary_display_name as string | undefined) ?? 'Someone'} sabotaged ${(p.target_display_name as string | undefined) ?? name}${holeSuffix}`;
      break;
  }

  return (
    <li
      className={[
        'flex items-center gap-3 rounded-xl border px-3 py-2',
        accent,
      ].join(' ')}
    >
      <div className="text-lg leading-none">{icon}</div>
      <div className="min-w-0 flex-1 text-sm">{text}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {formatTime(event.created_at)}
      </div>
    </li>
  );
}

function accentForType(type: ActivityEventType): string {
  switch (type) {
    case 'ace':
      return 'border-gold-500 bg-gold-500/15 text-gold-300';
    case 'eagle':
      return 'border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-200';
    case 'birdie':
      return 'border-gold-500/50 bg-gold-500/5 text-gold-200';
    case 'double_bogey_or_worse':
      return 'border-rose-700 bg-rose-900/30 text-rose-200';
    case 'exclusive_ace':
    case 'exclusive_eagle':
    case 'exclusive_birdie':
      return 'border-gold-400 bg-gold-500/15 text-gold-200';
    case 'putter_sabotage_target':
      return 'border-rose-700 bg-rose-900/30 text-rose-200';
    default:
      return 'border-slate-800 bg-slate-900/60 text-slate-200';
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
