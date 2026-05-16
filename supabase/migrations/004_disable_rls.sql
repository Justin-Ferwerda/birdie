-- Spec: "RLS off (private tournament app, one weekend lifespan)."
--
-- Supabase nudges new projects to enable RLS via dashboard warnings.
-- If RLS is on with no policies, the anon role gets zero rows back
-- silently (no error) — which looks exactly like an empty database.
--
-- Explicitly disable RLS on every table so the anon key (used
-- client-side) can read and write freely.

alter table people              disable row level security;
alter table tournaments         disable row level security;
alter table courses             disable row level security;
alter table holes               disable row level security;
alter table tournament_players  disable row level security;
alter table scores              disable row level security;
alter table rule_activations    disable row level security;
alter table activity_events     disable row level security;
