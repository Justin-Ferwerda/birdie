/** Helpers that decide which activity_event rows belong with a score / rule. */

import { supabase } from './supabase';
import type { ActivityEventType } from '../types/database';
import { categorize } from './scoring';

interface ScorePayload {
  tournament_id: string;
  player_number: number;
  hole_id: string;
  strokes: number;
  par: number;
  /** When set, a rule_activation event is also emitted. */
  rule_key?: string | null;
  rule_emoji?: string | null;
  rule_display_name?: string | null;
  /** Some rules surface a separate, more specific event (e.g.
   *  the_classic fires classic_failed instead of rule_activation
   *  when the player didn't clear). */
  rule_outcome?: Record<string, unknown> | null;
  /** Filled-in display name so the feed can render without joining. */
  player_display_name?: string | null;
  hole_number?: number | null;
  course_id?: string | null;
}

/** Score-quality event keys driven by raw category. */
const SCORE_QUALITY_EVENTS: ReadonlySet<ActivityEventType> = new Set([
  'ace',
  'eagle',
  'birdie',
  'double_bogey_or_worse',
  'rule_activation',
]);

function eventTypeForScore(strokes: number, par: number): ActivityEventType | null {
  const cat = categorize(strokes, par);
  switch (cat) {
    case 'ace':
      return 'ace';
    case 'eagle':
      return 'eagle';
    case 'birdie':
      return 'birdie';
    case 'double_bogey':
    case 'worse':
      return 'double_bogey_or_worse';
    default:
      return null;
  }
}

/** Wipe prior score-quality + rule_activation + classic_failed events for
 *  this (player, hole) so re-saves don't pile up duplicates. */
async function clearPriorEvents(p: ScorePayload) {
  const { error } = await supabase
    .from('activity_events')
    .delete()
    .eq('tournament_id', p.tournament_id)
    .eq('player_number', p.player_number)
    .eq('hole_id', p.hole_id)
    .in('event_type', [...Array.from(SCORE_QUALITY_EVENTS), 'classic_failed']);
  if (error) throw error;
}

/** Record the score-quality and rule_activation events that should accompany
 *  a score save. Safe to call from useEnterScore after the score upsert. */
export async function recordScoreEvents(p: ScorePayload) {
  await clearPriorEvents(p);

  const rows: Array<{
    tournament_id: string;
    event_type: ActivityEventType;
    player_number: number;
    hole_id: string;
    payload: Record<string, unknown>;
  }> = [];

  const scoreEvent = eventTypeForScore(p.strokes, p.par);
  if (scoreEvent) {
    rows.push({
      tournament_id: p.tournament_id,
      event_type: scoreEvent,
      player_number: p.player_number,
      hole_id: p.hole_id,
      payload: {
        strokes: p.strokes,
        par: p.par,
        to_par: p.strokes - p.par,
        player_display_name: p.player_display_name,
        hole_number: p.hole_number,
        course_id: p.course_id,
      },
    });
  }

  if (p.rule_key) {
    // The Classic gets its own classic_failed event on failure and
    // emits nothing on success — never the generic rule_activation event.
    if (p.rule_key === 'the_classic') {
      const cleared = (p.rule_outcome as { success?: boolean } | null)?.success;
      if (cleared === false) {
        rows.push({
          tournament_id: p.tournament_id,
          event_type: 'classic_failed',
          player_number: p.player_number,
          hole_id: p.hole_id,
          payload: {
            player_display_name: p.player_display_name,
            hole_number: p.hole_number,
            course_id: p.course_id,
          },
        });
      }
    } else {
      rows.push({
        tournament_id: p.tournament_id,
        event_type: 'rule_activation',
        player_number: p.player_number,
        hole_id: p.hole_id,
        payload: {
          rule_key: p.rule_key,
          rule_emoji: p.rule_emoji,
          rule_display_name: p.rule_display_name,
          player_display_name: p.player_display_name,
          hole_number: p.hole_number,
          course_id: p.course_id,
        },
      });
    }
  }

  if (rows.length === 0) return;
  const { error } = await supabase.from('activity_events').insert(rows);
  if (error) throw error;
}

/** For declarations / cross-card sabotage triggered outside of score entry. */
export async function recordDeclareEvents(args: {
  tournament_id: string;
  rule_key: string;
  rule_emoji?: string | null;
  rule_display_name?: string | null;
  primary_player_number: number;
  primary_display_name?: string | null;
  target_player_number?: number | null;
  target_display_name?: string | null;
  hole_id: string;
  hole_number?: number | null;
  course_id?: string | null;
  card_number?: number | null;
}) {
  const rows: Array<{
    tournament_id: string;
    event_type: ActivityEventType;
    player_number: number | null;
    hole_id: string;
    payload: Record<string, unknown>;
  }> = [];

  rows.push({
    tournament_id: args.tournament_id,
    event_type: 'rule_activation',
    player_number: args.primary_player_number,
    hole_id: args.hole_id,
    payload: {
      rule_key: args.rule_key,
      rule_emoji: args.rule_emoji,
      rule_display_name: args.rule_display_name,
      player_display_name: args.primary_display_name,
      hole_number: args.hole_number,
      course_id: args.course_id,
      card_number: args.card_number,
      declared: true,
    },
  });

  if (args.rule_key === 'putter_sabotage' && args.target_player_number != null) {
    rows.push({
      tournament_id: args.tournament_id,
      event_type: 'putter_sabotage_target',
      player_number: args.target_player_number,
      hole_id: args.hole_id,
      payload: {
        target_display_name: args.target_display_name,
        primary_display_name: args.primary_display_name,
        hole_number: args.hole_number,
        course_id: args.course_id,
      },
    });
  }

  const { error } = await supabase.from('activity_events').insert(rows);
  if (error) throw error;
}
