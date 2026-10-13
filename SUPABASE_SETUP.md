# PortfolioMgmt login and cloud storage

The account feature is configured to use the dedicated Supabase project named **PortfolioMgmt**. The browser uses only the project's public publishable key; never place a service-role key in the website.

## Supabase setup

1. Project URL and publishable key are set in `supabase-config.js`.
2. The `public.portfolios` table and owner-scoped row-level security policies have been created in the PortfolioMgmt Supabase project. The migration is also documented in [supabase/schema.sql](supabase/schema.sql).
3. In the Supabase Dashboard, open **Authentication → URL Configuration**. Set the Site URL to `https://shashankshashisingh.github.io/PortfolioMgmt/` and add the same URL to the allowed redirect URLs.
4. Under **Authentication → Providers → Email**, enable email/password. If email confirmation is enabled, users must confirm their email before their first session.

## Behaviour

- Visitors can use the example portfolio without signing in.
- Signed-in users save holdings, transactions, funds, metadata, series and targets to their own cloud row, keyed by their authenticated user ID and the `portfolio-mgmt` app name.
- On first sign-in, existing browser portfolio data is copied to the cloud if the account has no saved portfolio. The local portfolio copy is removed only after a successful migration save.
- If a cloud portfolio already exists, it takes precedence; any older browser copy is left untouched.
- Theme preference stays local to the browser.
- Email/password sign-up, sign-in, sign-out, and password reset are included.

## Verify before publishing

Test sign-up, email confirmation, sign-in, reload, password reset, and isolation with two test accounts. Cloud saving requires the Supabase project to be active and the authentication redirect URLs to include the GitHub Pages URL.
