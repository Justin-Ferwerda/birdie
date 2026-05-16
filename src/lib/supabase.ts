import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url) {
  throw new Error(
    'VITE_SUPABASE_URL is required. Copy .env.example to .env and fill in your Supabase URL.',
  );
}

if (!anonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is required. Copy .env.example to .env and fill in your Supabase anon key.',
  );
}

// Common mistake: pasting the full REST endpoint instead of the project URL.
// The JS client adds /rest/v1 itself; including it again produces a doubled
// path and a cryptic PGRST125 error.
if (/\/rest\/v\d/.test(url) || url.endsWith('/')) {
  throw new Error(
    `VITE_SUPABASE_URL should be the bare project URL (e.g. https://xxx.supabase.co), not "${url}". Strip any trailing slash or /rest/v1 path.`,
  );
}

export const supabase = createClient(url, anonKey);
