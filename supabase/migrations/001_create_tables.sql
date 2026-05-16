-- Birdie for Shurdy 2026 — schema
-- Paste into Supabase SQL Editor and run.

create extension if not exists pgcrypto;

-- Stable person identity across tournaments. Created from the Setup screen.
create table people (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  created_at timestamptz not null default now()
);

-- One row per annual tournament. Exactly one row should have is_active = true.
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  name text not null,
  is_active boolean not null default false,
  setup_complete boolean not null default false,
  shotgun_fired boolean not null default false,
  shotgun_fired_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index tournaments_single_active
  on tournaments ((is_active)) where is_active = true;

create table courses (
  id text primary key,
  display_name text not null,
  play_order int not null
);

create table holes (
  id text primary key,
  course_id text not null references courses(id),
  hole_number int not null,
  par int not null,
  pin_placement text,
  distance_ft text,
  notes text,
  unique (course_id, hole_number)
);

create table tournament_players (
  tournament_id uuid not null references tournaments(id),
  player_number int not null check (player_number between 1 and 12),
  person_id uuid not null references people(id),
  display_name text not null,
  card_number int not null check (card_number in (1, 2, 3)),
  is_scorekeeper boolean not null default false,
  primary key (tournament_id, player_number)
);

-- par_snapshot is denormalized from holes.par so the generated columns
-- below can be IMMUTABLE (Postgres disallows subqueries in GENERATED AS).
-- Par never changes mid-tournament, so this is safe.
create table scores (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id),
  player_number int not null,
  hole_id text not null references holes(id),
  strokes int not null check (strokes >= 1),
  par_snapshot int not null,
  rule_delta int not null default 0,
  hole_score_to_par int generated always as (strokes - par_snapshot) stored,
  adjusted_score_to_par int generated always as (strokes - par_snapshot + rule_delta) stored,
  entered_by_player_number int not null,
  entered_at timestamptz not null default now(),
  foreign key (tournament_id, player_number)
    references tournament_players(tournament_id, player_number),
  foreign key (tournament_id, entered_by_player_number)
    references tournament_players(tournament_id, player_number),
  unique (tournament_id, player_number, hole_id)
);

create table rule_activations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id),
  rule_key text not null,
  primary_player_number int not null,
  target_player_number int,
  partner_player_numbers jsonb,
  card_number int,
  hole_id text references holes(id),
  outcome jsonb,
  delta_applied int,
  created_at timestamptz not null default now(),
  foreign key (tournament_id, primary_player_number)
    references tournament_players(tournament_id, player_number)
);

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id),
  event_type text not null,
  player_number int,
  hole_id text references holes(id),
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Spec: "RLS off (private tournament app, one weekend lifespan)."
-- Supabase nudges new projects to enable RLS; if it's on without
-- policies, the anon client gets silent empty results. Disable
-- explicitly so the anon key works.
alter table people              disable row level security;
alter table tournaments         disable row level security;
alter table courses             disable row level security;
alter table holes               disable row level security;
alter table tournament_players  disable row level security;
alter table scores              disable row level security;
alter table rule_activations    disable row level security;
alter table activity_events     disable row level security;
