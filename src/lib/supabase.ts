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

export const supabase = createClient(url, anonKey);
