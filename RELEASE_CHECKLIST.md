# Release checklist

- [ ] All values in `.env.example` are configured through the production secret/config store.
- [ ] Supabase backup completed and migrations applied successfully in staging and production.
- [ ] Supabase email/password, reset redirect and Google provider URLs match the production domain.
- [ ] `ALLOWED_ORIGINS` contains only the intended HTTPS frontend origins.
- [ ] The same strong `API_PROXY_SECRET` is configured as a Cloudflare Worker secret and Cloud Run secret before `TRUST_PROXY_HEADERS=true`.
- [ ] Clash API token allows requests from the production backend IP.
- [ ] `npm ci`, `npm run check`, `mvn test` and `mvn package` pass in CI.
- [ ] `/health` returns 200 and `/ready` returns 200 after deployment.
- [ ] An unknown `/api/...` URL returns a JSON 404 and an unknown page or asset returns an HTTP 404.
- [ ] Static responses include the expected security headers and the `workers.dev` preview is `noindex`.
- [ ] `www.clashpanel.com` permanently redirects to the canonical `https://clashpanel.com` host.
- [ ] Two-user authorization checks pass for plans, friends, groups, polls and notifications.
- [ ] Register, login, reset, logout and Google sign-in are manually verified.
- [ ] Account token verification and duplicate ownership protection are manually verified.
- [ ] Planner save/reload, rapid switching and touch/keyboard move controls are verified.
- [ ] Operation Board is checked against at least one preparation, in-war and ended fixture.
- [ ] Poll answers, admin results, six-hour reminder cooldown and unread notifications are verified.
- [ ] Bracket save/import/export and draft rename/copy/delete are verified.
- [ ] Secret scan is clean and any credential ever committed has been rotated.
- [ ] Supabase security and performance advisors have been rerun after migrations; leaked-password protection is enabled.
- [ ] Logs and monitoring are configured without auth tokens, player tokens or service-role values.

External credentials and live production data are required for the unchecked integration items; they are release blockers until verified.
