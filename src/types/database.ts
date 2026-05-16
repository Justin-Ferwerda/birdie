// Hand-rolled Supabase row types. Keep in sync with supabase/migrations/.
// (Not using `supabase gen types` for 2026 — keeps the workflow CLI-free.)

export interface Person {
  id: string;
  display_name: string;
  created_at: string;
}

export interface Tournament {
  id: string;
  year: number;
  name: string;
  is_active: boolean;
  setup_complete: boolean;
  shotgun_fired: boolean;
  shotgun_fired_at: string | null;
  created_at: string;
}

export type CourseId = 'seven_oaks' | 'crockett' | 'cedar_hill';

export interface Course {
  id: CourseId;
  display_name: string;
  play_order: number;
}

export interface Hole {
  id: string;
  course_id: CourseId;
  hole_number: number;
  par: number;
  pin_placement: string | null;
  distance_ft: string | null;
  notes: string | null;
}

export interface TournamentPlayer {
  tournament_id: string;
  player_number: number;
  person_id: string;
  display_name: string;
  card_number: 1 | 2 | 3;
  is_scorekeeper: boolean;
}

export interface Score {
  id: string;
  tournament_id: string;
  player_number: number;
  hole_id: string;
  strokes: number;
  par_snapshot: number;
  rule_delta: number;
  hole_score_to_par: number;
  adjusted_score_to_par: number;
  entered_by_player_number: number;
  entered_at: string;
}

export interface RuleActivation {
  id: string;
  tournament_id: string;
  rule_key: string;
  primary_player_number: number;
  target_player_number: number | null;
  partner_player_numbers: number[] | null;
  card_number: number | null;
  hole_id: string | null;
  outcome: Record<string, unknown> | null;
  delta_applied: number | null;
  created_at: string;
}

export type ActivityEventType =
  | 'ace'
  | 'eagle'
  | 'birdie'
  | 'double_bogey_or_worse'
  | 'rule_activation'
  | 'shotgun_event'
  | 'classic_failed'
  | 'exclusive_birdie'
  | 'exclusive_eagle'
  | 'exclusive_ace'
  | 'hardest_hole'
  | 'easiest_hole'
  | 'putter_sabotage_target';

export interface ActivityEvent {
  id: string;
  tournament_id: string;
  event_type: ActivityEventType;
  player_number: number | null;
  hole_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}
