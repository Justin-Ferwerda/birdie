import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useActiveTournament } from '../hooks/useActiveTournament';
import { useMyPlayer } from '../hooks/useMyPlayer';
import PutterSabotageTakeover from './PutterSabotageTakeover';
import { celebrate } from '../lib/celebrate';
import type { ActivityEvent } from '../types/database';

type EventPayload = {
  rule_emoji?: string;
  rule_display_name?: string;
  rule_key?: string;
  player_display_name?: string;
  target_display_name?: string;
  primary_display_name?: string;
  hole_number?: number;
  strokes?: number;
  par?: number;
};

function payloadOf(e: ActivityEvent): EventPayload {
  return (e.payload ?? {}) as EventPayload;
}

/** Mounted at App root. Subscribes to activity_events INSERTs and dispatches
 *  toasts + invalidates queries so the scorecard refreshes live. */
export default function RealtimeListener() {
  const tournament = useActiveTournament();
  const tournament_id = tournament.data?.id;
  const { playerNumber } = useMyPlayer();
  const qc = useQueryClient();

  const [sabotage, setSabotage] = useState<{
    primaryName: string;
    holeNumber: number | null;
  } | null>(null);

  useEffect(() => {
    if (!tournament_id) return;

    const channel = supabase
      .channel(`activity-events:${tournament_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_events',
          filter: `tournament_id=eq.${tournament_id}`,
        },
        (incoming) => {
          const event = incoming.new as ActivityEvent;
          handleEvent(event, playerNumber, setSabotage);
          // Bust caches for anything the event implies changed.
          qc.invalidateQueries({ queryKey: ['scores', tournament_id] });
          qc.invalidateQueries({ queryKey: ['rule-activations', tournament_id] });
          qc.invalidateQueries({ queryKey: ['activity-events', tournament_id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament_id, playerNumber, qc]);

  // Also push-update the scorecard when someone else writes a score directly.
  useEffect(() => {
    if (!tournament_id) return;
    const channel = supabase
      .channel(`scores:${tournament_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          filter: `tournament_id=eq.${tournament_id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['scores', tournament_id] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament_id, qc]);

  if (!sabotage) return null;
  return (
    <PutterSabotageTakeover
      primaryName={sabotage.primaryName}
      holeNumber={sabotage.holeNumber}
      onDismiss={() => setSabotage(null)}
    />
  );
}

function handleEvent(
  event: ActivityEvent,
  myPlayerNumber: number | null,
  setSabotage: (v: { primaryName: string; holeNumber: number | null } | null) => void,
) {
  const p = payloadOf(event);
  const name = p.player_display_name ?? `Player ${event.player_number ?? '?'}`;
  const hole = p.hole_number ?? null;
  const holeSuffix = hole != null ? ` (H${hole})` : '';

  const cellKey =
    event.player_number != null && event.hole_id
      ? `${event.player_number}:${event.hole_id}`
      : null;

  switch (event.event_type) {
    case 'ace':
      toast.success(`🥇 ACE — ${name}${holeSuffix}!`, {
        duration: 6000,
        className: 'text-base font-bold',
      });
      if (cellKey) celebrate(cellKey, 'ace');
      break;
    case 'eagle':
      toast.success(`🦅 Eagle — ${name}${holeSuffix}`, { duration: 5000 });
      if (cellKey) celebrate(cellKey, 'eagle');
      break;
    case 'birdie':
      toast.success(`🐦 Birdie — ${name}${holeSuffix}`, { duration: 3500 });
      if (cellKey) celebrate(cellKey, 'birdie');
      break;
    case 'double_bogey_or_worse':
      toast.error(`💀 ${name} ${p.strokes ?? '?'}${holeSuffix}`, { duration: 3500 });
      break;
    case 'rule_activation':
      toast(
        `${p.rule_emoji ?? '•'} ${name} — ${p.rule_display_name ?? 'a rule'}${holeSuffix}`,
        { duration: 4000 },
      );
      break;
    case 'shotgun_event': {
      const fastest =
        (p as { fastest_display_name?: string }).fastest_display_name ?? name;
      toast(`🍺 THE SHOTGUN — fastest: ${fastest}`, {
        duration: 6000,
        className: 'text-base font-bold',
      });
      break;
    }
    case 'classic_failed':
      toast(`👖 ${name} failed The Classic`, { duration: 5000 });
      break;
    case 'exclusive_ace':
    case 'exclusive_eagle':
    case 'exclusive_birdie':
      toast.success(`✨ ONLY ONE — ${name}${holeSuffix}`, { duration: 6000 });
      break;
    case 'hardest_hole':
      toast(`🔥 Hardest hole on ${event.hole_id}`, { duration: 4000 });
      break;
    case 'easiest_hole':
      toast(`🍃 Easiest hole on ${event.hole_id}`, { duration: 4000 });
      break;
    case 'putter_sabotage_target':
      if (event.player_number === myPlayerNumber) {
        setSabotage({
          primaryName: p.primary_display_name ?? 'Someone',
          holeNumber: p.hole_number ?? null,
        });
      } else {
        toast(
          `🎯 ${p.primary_display_name ?? 'Someone'} sabotaged ${p.target_display_name ?? name}`,
          { duration: 4000 },
        );
      }
      break;
  }
}
