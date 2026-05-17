-- Phase M1: minigames feature
--
-- Adds two tables (minigames + minigame_placements), the indexes the
-- queries lean on, the partial unique index that prevents duplicate
-- minigame_champion events, then seeds the 6 minigames for the currently
-- active tournament via a cross join.
--
-- Run in the Supabase SQL Editor. Idempotent re-runs are NOT safe for
-- the seed (would error on the minigames PK); the table creates use
-- bare CREATE TABLE (no IF NOT EXISTS) so a re-run will fail loudly.

create table minigames (
  id text primary key,
  display_name text not null,
  description text,
  play_order int not null,
  tournament_id uuid not null references tournaments(id)
);

create table minigame_placements (
  id uuid primary key default gen_random_uuid(),
  minigame_id text not null references minigames(id),
  tournament_id uuid not null references tournaments(id),
  player_number int not null,
  place int not null check (place in (1, 2, 3)),
  -- 4 - place gives 3/2/1 for 1st/2nd/3rd.
  points int generated always as (4 - place) stored,
  recorded_by_player_number int,
  recorded_at timestamptz not null default now(),
  foreign key (tournament_id, player_number)
    references tournament_players(tournament_id, player_number),
  -- One player per place per game.
  unique (tournament_id, minigame_id, place),
  -- A player can't hold two places in the same game.
  unique (tournament_id, minigame_id, player_number)
);

create index minigame_placements_by_game
  on minigame_placements (tournament_id, minigame_id);
create index minigame_placements_by_player
  on minigame_placements (tournament_id, player_number);

-- Matches the rest of the schema (private one-weekend app, anon-only access).
alter table minigames           disable row level security;
alter table minigame_placements disable row level security;

-- Realtime: both tables broadcast inserts/updates so other phones refresh.
alter publication supabase_realtime add table minigames;
alter publication supabase_realtime add table minigame_placements;

-- One champion event per tournament. Client deletes + re-fires on edit
-- when the leader changes (see Phase M6).
create unique index minigame_champion_once
  on activity_events (tournament_id, event_type)
  where event_type = 'minigame_champion';

-- Seed the 6 minigames against whatever tournament is currently active.
-- If no tournament has is_active = true, this inserts zero rows.
insert into minigames (id, display_name, description, play_order, tournament_id)
select v.id, v.display_name, v.description, v.play_order, t.id
from (values
  ('longest_drive',   'Longest Drive',                null::text, 1),
  ('ctp_roller',      'Closest to the Pin - Roller',  null::text, 2),
  ('ctp_upshot',      'Closest to the Pin - Upshot',  null::text, 3),
  ('ctp_fairway',     'Closest to the Pin - Fairway', null::text, 4),
  ('putter_knockout', 'Putter Knockout',              null::text, 5),
  ('longest_putt',    'Longest Putt',                 null::text, 6)
) as v(id, display_name, description, play_order)
cross join (select id from tournaments where is_active = true limit 1) t;
