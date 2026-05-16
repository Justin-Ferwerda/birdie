-- Per-person avatar. Stored as a stable id (filename stem of an asset
-- bundled under src/assets/avatars/). Stays with the person across
-- tournaments so returning players keep their avatar.

alter table people
  add column avatar_id text;
