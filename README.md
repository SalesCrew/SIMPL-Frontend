# SIMPL Frontend

React + TypeScript taskboard. Production hosting: Vercel.

## Development

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, set the public Supabase URL/publishable key and `VITE_API_URL`, then run `npm run dev`.

`npm test` runs the unit tests. `npm run build` type-checks and creates `dist/`.

## Deployment

Import `SalesCrew/SIMPL-Frontend` into Vercel with this repository as the root directory. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_API_URL` (the Railway backend HTTPS origin), and `VITE_DEMO_MODE=false` for production.

Only publishable configuration belongs in `VITE_` variables. Never add the Supabase secret/service-role key to the frontend or Git.

The companion API is [SIMPL-Backend](https://github.com/SalesCrew/SIMPL-Backend). Auth, authorized board operations, Realtime, and file transfers use Supabase directly with RLS; privileged account and attachment operations use the API.
