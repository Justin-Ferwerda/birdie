-- Indexes + the partial unique index that prevents duplicate
-- exclusivity / hardest / easiest events when two scorekeepers race.

create index scores_tournament_player_idx
  on scores (tournament_id, player_number);

create index scores_tournament_hole_idx
  on scores (tournament_id, hole_id);

create index activity_events_tournament_recent_idx
  on activity_events (tournament_id, created_at desc);

create index rule_activations_tournament_player_idx
  on rule_activations (tournament_id, primary_player_number);

create index tournament_players_tournament_idx
  on tournament_players (tournament_id);

-- One-shot events that should only ever fire once per (tournament, hole).
-- The 12th-score scorekeeper triggers these; a unique constraint guards
-- against races between two scorekeepers finishing the last hole.
create unique index activity_events_one_shot_per_hole
  on activity_events (tournament_id, event_type, hole_id)
  where event_type in (
    'exclusive_ace',
    'exclusive_eagle',
    'exclusive_birdie',
    'hardest_hole',
    'easiest_hole'
  );
