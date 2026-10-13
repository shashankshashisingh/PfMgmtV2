# Cloud accounts with Supabase

This branch adds email/password signup and login, plus per-account cloud storage for the dashboard's user portfolio. GitHub Pages remains the static frontend; Supabase handles authentication and database storage.

## One-time setup

1. Create a project at https://supabase.com/.
2. In **SQL Editor**, run the contents of [supabase/schema.sql](supabase/schema.sql). Row-level security restricts each user to their own row.
3. In **Project Settings → API** (or Connect), copy the project URL and the publishable/anon key. Put them in `supabase-config.js`:
   - `YOUR_SUPABASE_PROJECT_URL` → your project URL
   - `YOUR_SUPABASE_ANON_KEY` → the publishable/anon key
   Never use the `service_role` key in the website.
4. In **Authentication → URL Configuration**, set the Site URL to `https://shashankshashisingh.github.io/PortfolioMgmt/` and add that URL to the allowed redirect URLs.
5. In **Authentication → Providers → Email**, keep email/password enabled. If email confirmation is enabled, users must confirm their email before the first session is created.

## Behaviour

- Visitors can still use the example portfolio without signing in.
- When signed in, holdings, transactions, funds, metadata, series and targets are loaded from and saved to the signed-in user's Supabase row; browser localStorage is not used for the portfolio while signed in.
- On the first sign-in, existing local portfolio data is migrated to the account if the account has no saved portfolio yet. Once the cloud copy is saved successfully, the old local portfolio copy is removed.
- Theme preference remains local to the browser.
- Saves are debounced briefly to avoid a database write on every keystroke.

## Before publishing

Configure the Supabase project and verify signup, email confirmation (if enabled), login, data isolation with two test accounts, reload, and sign-out. This feature cannot persist to a cloud account until the project URL/key and SQL schema are configured.
