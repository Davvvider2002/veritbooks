# Attest

Engagement files for Nigerian audit, review and compilation work. Working name.
See [docs/PLATFORM.md](docs/PLATFORM.md) for what the platform does and does not do.

## Run it

```
npm install
npm run dev
```

With no Supabase keys set, the app runs in demo mode and keeps data in the browser.
Sample trial balances are in `public/samples`.

## Connect Supabase

1. Apply `supabase/migrations/0001_init.sql` to the project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Set the same two variables in Netlify.

## Deploy

Netlify reads `netlify.toml`: build command `npm run build`, publish directory `dist`.

## Check it

```
npm test                  # engine: parsing, mapping, statements, gates, report wording
node scripts/test-db.mjs  # database: security rules, lock and sign-off, against an in-process Postgres
npm run build
```

## Layout

| Path | Contents |
| --- | --- |
| `src/engine` | Calculation code. No screen or database dependency. |
| `src/content` | Work programmes and policy wording, as versioned data. |
| `src/data` | Storage: Supabase and demo mode behind one interface. |
| `src/steps`, `src/pages.tsx`, `src/workspace.tsx` | Screens. |
| `supabase/migrations` | Database schema and security rules. |
