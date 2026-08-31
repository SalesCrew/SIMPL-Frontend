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
