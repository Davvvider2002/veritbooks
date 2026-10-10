# VeritBooks

Engagement files for Nigerian audit, review and compilation work.
See [docs/PLATFORM.md](docs/PLATFORM.md) for what the platform does and does not do.

## Run it

```
npm install
npm run dev
```

With no Supabase keys set, the app runs in demo mode and keeps data in the browser.
Sample trial balances, a general ledger and a bank statement are in `public/samples`.
`node scripts/make-samples.mjs` regenerates the ledger and the statement.

## Connect Supabase

1. Apply the files in `supabase/migrations` to the project, in number order. Each runs once.
2. Production values are in `.env.production` and are used by every build. For local work against the database, copy them to `.env.local`.

## Deploy

Netlify reads `netlify.toml`: build command `npm run build`, publish directory `dist`.

## Check it

```
npm test                  # engine: parsing, mapping, statements, journal testing, bank reconciliation, gates
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
