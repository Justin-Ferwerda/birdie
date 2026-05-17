-- Clears all minigame placements + the champion event for the active
-- tournament. Leaves game definitions (the minigames table) intact and
-- doesn't touch any main-tournament data.
--
-- Save this as a saved query in the Supabase SQL Editor for fast access
-- during testing.

delete from activity_events
where tournament_id = (select id from tournaments where is_active = true)
  and event_type in (
    'minigame_first_place',
    'minigame_podium',
    'minigame_champion'
  );

delete from minigame_placements
where tournament_id = (select id from tournaments where is_active = true);
