# Database migrations

Take a verified database backup before applying migrations to an existing Supabase project. Apply every file once, in filename order:

1. `20260620_group_badge_and_poll_defaults.sql`
2. `20260620_group_clans.sql`
3. `20260620_group_member_roles.sql`
4. `20260716_001_auth_profiles_and_core_rls.sql`
5. `20260716_002_accounts_polls_notifications.sql`
6. `20260716_003_persistent_api_cache.sql`
7. `20260716_004_poll_transactions_and_reminders.sql`

Before migration 001, check for duplicate profile email/auth mappings, orphaned group or plan memberships, and duplicate plan links. Before migration 002, run `CHECK_BEFORE_GROUP_MEMBER_UNIQUE_INDEX.sql`, inspect invalid or duplicate player tags, and resolve any player tag owned by multiple users.

The July migrations are forward-only because they normalize legacy JSON account and poll data and tighten RLS. The safe rollback is to restore the pre-migration backup and redeploy the matching previous application version. Do not drop the new tables or columns selectively after new writes have occurred.

Run `npm run check:migrations` before applying. Apply to a staging copy first, verify record counts and authorization with two test users, then repeat on production during a maintenance window.
