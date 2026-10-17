# Supabase setup for PricePulse World

## What is ready in this repository
- Sign-up/login UI calls Supabase Auth when configured.
- `supabase/schema.sql` defines the shared profiles, shops, approved price reports and favorites tables with row-level security.
- Guest browsing remains available without an account.

## One-time Supabase setup
1. Open the Supabase project for PricePulse World (or create a free project) at https://supabase.com/dashboard.
2. Open **SQL Editor**, create a query, paste all of `supabase/schema.sql`, and run it.
3. Open **Project Settings → API** (or **Data API**) and copy the project URL and the public anon/publishable key. Never use the `service_role` / secret key in the frontend.
4. In Netlify, open the `pricepulse-world` site under the correct team, then **Project configuration → Environment variables**. Add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your public anon/publishable key
   Scope both to production and builds (or all contexts).
5. Trigger a new production deploy from the latest `main` commit.
6. In Supabase **Authentication → URL Configuration**, set Site URL to `https://pricepulse-world.netlify.app` and add that URL to the Redirect URLs allow-list.
7. In **Authentication → Providers → Email**, enable email sign-ups and configure email confirmation to your preference. For production, email confirmation is recommended.

## Important security notes
- Never put a database password or Supabase `service_role` / secret key in a `VITE_*` variable, frontend code, GitHub, or a chat.
- This schema intentionally does not allow users to approve their own reports or shops. Secure admin approval requires a trusted server-side admin role/function; do not use a browser-only admin flag.
- Existing prototype data in browser localStorage is not automatically migrated to the shared database.
- Authentication screens can be tested after environment variables are set and a new deployment completes. Shared shop/price workflows still need to be connected to these tables before the whole product uses shared data.
