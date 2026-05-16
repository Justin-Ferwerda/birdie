-- Phase 13: rule-photos bucket for photo-required rules.
--
-- Public-read so the URL stored in rule_activations.outcome.photo_url
-- can be loaded directly by any client. Anon-write because the app
-- has no auth (private one-weekend app).

insert into storage.buckets (id, name, public)
values ('rule-photos', 'rule-photos', true)
on conflict (id) do nothing;

-- Storage RLS is enforced even when our app tables have it off.
-- These two policies open the bucket for anonymous read + write.

create policy "anon can upload rule photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'rule-photos');

create policy "anyone can view rule photos"
  on storage.objects for select
  using (bucket_id = 'rule-photos');
