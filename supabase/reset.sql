-- Pre-tournament reset. Wipes play data, preserves reference data
-- (courses, holes) and the 2026 tournament row. Run in the Supabase
-- SQL Editor before Saturday morning.
--
-- After running this, the app boots into the Setup screen on next load.
-- Note: this does NOT clear the per-phone identity stored in browser
-- localStorage. To re-test the identity picker, open in incognito or
-- delete the `birdie.myPlayerNumber` key in DevTools.

-- Postgres requires every table that references one of the truncated
-- tables to be in the same TRUNCATE statement (or CASCADE). Listing
-- them together avoids 0A000 "cannot truncate" errors.
truncate table
  activity_events,
  rule_activations,
  scores,
  tournament_players,
  people;

update tournaments
   set setup_complete    = false,
       shotgun_fired     = false,
       shotgun_fired_at  = null
 where year = 2026;
