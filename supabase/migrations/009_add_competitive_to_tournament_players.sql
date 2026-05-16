-- Lets a tournament include non-competitive guests who can still enter
-- scores (e.g. someone who only joins for the final round). Default true
-- so existing players are unaffected.

alter table tournament_players
  add column competitive boolean not null default true;
