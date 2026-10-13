# Cloud accounts with Supabase

The account feature is wired to the Supabase project configured in `supabase-config.js`. It uses the existing `public.portfolios` table with a separate app key (`portfolio-mgmt`), so rows used by other apps are not overwritten.

## Supabase dashboard checklist

1. Open the project configured in `supabase-config.js`.
2. Confirm the `public.portfolios` table exists with `user_id uuid`, `app text`, `data jsonb`, `updated_at timestamptz`, and a composite primary key on `(user_id, app)`. The current connected project already has this structure.
3. Confirm Row Level Security is enabled and policies only allow an authenticated user to select/insert/update rows where `auth.uid() = user_id`. The current project already has owner-based policies; `supabase/schema.sql` contains the hardened policy definition for a fresh setup.
4. In **Authentication → URL Configuration**, set the Site URL to `https://shashankshashisingh.github.io/PortfolioMgmt/` and add it to the allowed redirect URLs.
5. In **Authentication → Providers → Email**, enable email/password. If email confirmation is enabled, users must confirm their email before the first session is created.

## Behaviour

- Visitors can still use the example portfolio without signing in.
- Signed-in users save holdings, transactions, funds, metadata, series and targets to their own cloud row. The app filters by both the authenticated user ID and the `portfolio-mgmt` app key.
- On first sign-in, existing browser portfolio data is copied to the cloud if the account does not already have a saved portfolio. The browser copy is removed only after a successful migration save.
- If a cloud portfolio already exists, it takes precedence; any old browser copy is left untouched rather than silently discarded.
- Theme preference remains local to the browser.
- Email/password signup, login, sign-out, and password reset are included.

## Before going live

Test signup and email confirmation, login, reload, password reset, and isolation with two separate test accounts. Cloud saving requires the Supabase project to be active and the auth redirect URLs to include the GitHub Pages URL.
