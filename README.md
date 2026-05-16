# Birdie for Shurdy 2026

A mobile-first disc golf scoring app for a 12-player, 3-course, 2-day tournament with a heavy social/rules layer.

Built with **Vite + React + TypeScript + Tailwind + Supabase**.

---

## Quick start

```bash
nvm use                       # picks up Node 20 from .nvmrc
npm install
cp .env.example .env          # then edit .env with your Supabase values
npm run dev
```

Vite prints both a `Local` and a `Network` URL. Use the Network URL to open the app on your phone (same Wi-Fi as your laptop).

---

## Secrets policy

**No secrets, keys, URLs, or credentials are ever hardcoded in source files.** All configuration flows through environment variables via `.env`.

- `.env` is gitignored. Never commit it.
- `.env.example` is committed with placeholder values only.
- The Supabase client throws clear errors if env vars are missing — no fallback defaults in code.
- The Supabase **anon key** is safe to ship in the client bundle (RLS would be the gate; for this private one-weekend app RLS is intentionally off). The **service_role key** is never used client-side and is not part of this project.
- If a key is ever accidentally committed, rotate it in the Supabase dashboard (Project Settings → API → Reset anon key) before pushing the fix.
- Netlify env vars are set in the Netlify dashboard under **Site Settings → Environment Variables**, using the same names as local `.env`.

---

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → API** — copy the `Project URL` and `anon public` key into your local `.env`. Also paste them into Netlify under **Site Settings → Environment Variables**.
3. Open the **SQL Editor** and run the migrations *in order*:
   1. `supabase/migrations/001_create_tables.sql` — creates `people`, `tournaments`, `courses`, `holes`, `tournament_players`, `scores`, `rule_activations`, `activity_events`.
   2. `supabase/migrations/002_create_indexes.sql` — query indexes plus the partial unique index that prevents duplicate exclusivity/hardest/easiest events.
   3. `supabase/migrations/003_seed_courses_and_holes.sql` — seeds the 3 courses, all 54 holes, and inserts the 2026 tournament row with `is_active = true`.
4. RLS is intentionally **off** for this private, one-weekend app. The anon key is the only auth in play; the spec accepts that tradeoff.

### Reset before tournament day

Paste `supabase/reset.sql` into the SQL Editor. Truncates play data, preserves courses/holes/the 2026 tournament row, and clears `setup_complete`. App boots back into the Setup screen.

### Re-seed reference data

If you ever need to re-seed courses + holes (e.g. after a hole correction), paste `supabase/seed.sql` — it's idempotent.

### Schema deviation from the spec

`scores` stores a `par_snapshot` column (denormalized from `holes.par`) so the `hole_score_to_par` and `adjusted_score_to_par` generated columns are valid IMMUTABLE expressions. Postgres disallows subqueries in `GENERATED ALWAYS AS`, so the spec's exact SQL won't compile. Par never changes mid-tournament, so the denormalization is safe. The client supplies `par_snapshot` on insert.

---

## Phone testing

`npm run dev` runs with `--host` enabled, so Vite prints a Network URL like `http://192.168.x.x:5173`. Open that on your phone (same Wi-Fi network). Hot reload works on the phone too.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Port 5173 in use | `npm run dev -- --port 3000` |
| Stale cached behavior | `rm -rf node_modules/.vite` |
| Module not found | `npm install` |
| Wrong Node version | `nvm use` (picks up `.nvmrc`) |
| `.env` changes not applied | Restart `npm run dev` — env vars are not hot-reloaded |

These changes also require a dev server restart: `vite.config.ts`, `tsconfig.json`, `package.json` dependencies, `tailwind.config.js`, `.env`.

---

## Netlify deployment

- Build command: `npm run build`
- Publish directory: `dist`
- Environment variables (set in dashboard):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- A `netlify.toml` at the repo root configures the build + SPA fallback for client-side routes.

---

## Project structure

```
birdie/
├── src/
│   ├── components/        UI building blocks (nav, placeholders, …)
│   ├── pages/             Top-level route screens
│   ├── lib/               Supabase client, query client, future helpers
│   ├── App.tsx            Router + layout
│   ├── main.tsx           App entry, providers
│   └── index.css          Tailwind directives
├── public/
├── supabase/              migrations + seed + reset SQL
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── netlify.toml
├── .nvmrc                 Node 20
├── .env.example
└── .gitignore
```

---

## Implementation phases

See the full spec for the 18-phase build plan. Current status: **Phase 2 Supabase setup complete.** The Home page renders a smoke test for the active tournament + hole count.
