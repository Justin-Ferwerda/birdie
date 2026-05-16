-- Pre-tournament reset. Wipes play data, preserves reference data
-- (courses, holes) and the 2026 tournament row. Run in the Supabase
-- SQL Editor before Saturday morning.
--
-- After running this, the app boots into the Setup screen on next load.

truncate table activity_events;
truncate table rule_activations;
truncate table scores;
truncate table tournament_players;
delete from people;

update tournaments
   set setup_complete    = false,
       shotgun_fired     = false,
       shotgun_fired_at  = null
 where year = 2026;
