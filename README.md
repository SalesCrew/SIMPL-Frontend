# SIMPL Frontend

React + TypeScript taskboard. Production: https://get-simpl.vercel.app, hosted by Vercel project `sales-crew/simpl`. GitHub `main` automatically deploys the latest version.

## Development

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, set the public Supabase URL/publishable key and `VITE_API_URL`, then run `npm run dev`.

`npm test` runs the unit tests. `npm run build` type-checks and creates `dist/`.

## Deployment

Import `SalesCrew/SIMPL-Frontend` into Vercel with this repository as the root directory. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL` (the Railway backend HTTPS origin), and `VITE_DEMO_MODE=false` for production.

Only publishable configuration belongs in `VITE_` variables. Never add the Supabase secret/service-role key to the frontend or Git.

After login, `account_access_context()` runs before any workspace loading. Accounts with a temporary password see only the white first-login password form. Successful setup records a server-owned Supabase stamp and signs in with the new password; no password is stored in application state beyond the active form/submission. The database and API enforce the same gate independently of the UI.

The companion API is [SIMPL-Backend](https://github.com/SalesCrew/SIMPL-Backend), hosted at https://simpl-backend-production.up.railway.app. Auth, authorized board operations, Realtime, and uploads use Supabase directly with RLS. Account operations, attachment finalization/removal and every file download use the API. Downloads must not fall back to direct Storage URLs: live authorization is checked by the backend on every request, and client Storage reads are denied.

## Private Development analytics

An ordinary app URL opens the Taskboard for every account. Navigation stores the selected page in the URL, so refreshing keeps that page; explicit `?view=insights` and meeting links still work. The verified owner's `Dein Fortschritt` navigation sits immediately above `Team & Zugänge`. Its permission check, lazy page download and initial data fetch share a responsive dashboard skeleton while the application navigation remains usable. The API independently verifies the owner, active account and existing workspace permissions; client visibility alone grants no access. Deploy the companion backend endpoint before this frontend.

`src/features/personal-analytics` contains the isolated report runtime, SIMPL controls and per-chart moving averages. Data is fetched at runtime with the current user's session and is never bundled or persisted in browser storage. UI selections survive a snapshot refresh only in memory. Tick windows average complete, consecutive displayed day/week/month intervals; missing and partial intervals stay blank. Normalized averages use their original source's domain. Relationship analysis continues to use original metrics.

The overlay quick selection “Menge & Durchlaufzeit” compares completion throughput with task-weighted calendar hours from the owner's native “Gelesen” stamp to “Fertig”. Daily and rolling 28-day views are selectable; imported review stamps and unsupported pairs remain excluded only from these metrics. In “Schwellenwerte”, “Durchschnitt einer Datenreihe” creates a dynamically recalculated horizontal mean reference for a chosen displayed series and period, preserving native/normalized axis semantics. See [metric and reference details](docs/private-meeting-context.md).

The imported report code is checked in, with source hashes in `source-provenance.json`. `scripts/import-personal-analytics.mjs` is an optional maintainer import for the original report code and static markup; it does not import data and is not part of the normal build. Preserve the app adapters and run the analytics tests after importing.
