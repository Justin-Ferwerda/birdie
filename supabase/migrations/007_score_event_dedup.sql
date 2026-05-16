-- Phase 8: dedup the per-score event types so re-saving the same hole
-- doesn't fire duplicate birdies / aces / etc. The client also deletes
-- prior events for the (player, hole) before inserting, but this is the
-- belt-and-suspenders constraint.

create unique index activity_events_score_quality_per_player_hole
  on activity_events (tournament_id, event_type, player_number, hole_id)
  where event_type in (
    'ace',
    'eagle',
    'birdie',
    'double_bogey_or_worse',
    'rule_activation'
  );
