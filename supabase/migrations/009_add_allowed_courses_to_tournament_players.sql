-- Per-player allowed courses, for guests who only play part of the
-- tournament (e.g. someone joining for just the final round at Cedar
-- Hill). NULL = plays all 3 courses (default behavior).
--
-- Detection ("all N players scored hole H") filters by who's playing the
-- hole's course; whole-card rules (Gentlemen's Tee, Play-through Parade)
-- skip players not on that course. Leaderboard surfaces guests in a
-- separate section.

alter table tournament_players
  add column allowed_courses text[];

-- Sanity check: every element should be a known course id. We can't FK
-- to a unnest, so just constrain by the known set.
alter table tournament_players
  add constraint tournament_players_allowed_courses_valid
  check (
    allowed_courses is null
    or allowed_courses <@ array['seven_oaks', 'crockett', 'cedar_hill']::text[]
  );
