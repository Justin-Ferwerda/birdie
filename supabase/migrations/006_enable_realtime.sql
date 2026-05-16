-- Phase 8: enable Postgres Realtime for activity_events so every phone
-- gets pushed inserts (toasts, full-screen takeovers, feed updates).
--
-- Also enable for scores and rule_activations so the scorecard refreshes
-- live on other phones instead of waiting for TanStack Query's staleTime.

alter publication supabase_realtime add table activity_events;
alter publication supabase_realtime add table scores;
alter publication supabase_realtime add table rule_activations;
