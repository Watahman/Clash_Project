# Database migrations

ClashPanel uses forward-only PostgreSQL/Supabase migrations stored in `database/migrations/`.

## Rules

- Treat every applied migration as immutable history. Do not rename, reorder, edit, or delete an applied migration just because a later migration supersedes its schema.
- New schema changes get a new timestamped migration file.
- Apply migrations exactly once and in filename order.
- Take a verified production backup before schema changes.
- Apply and verify on a staging copy first when a migration changes stored data, RLS, RPCs, indexes, or constraints.
- Never place ad-hoc production fixes at the repository root; convert them into a real migration or remove them after use.

## Validation

Run `npm run check:migrations` before deployment. The check validates ordering and naming across the complete migration directory, so this document intentionally does not duplicate a migration-number list that can become stale.

Advanced Stats has optional database verification commands:

```text
npm run check:advanced-stats-db
npm run smoke:advanced-stats-db
```

Those commands require an explicit `SUPABASE_DB_URL` and are manual maintenance tools, not part of the normal repository check.

## Rollback

Most migrations tighten security, normalize data, or add structures used by newer code. The safe rollback for an already-used destructive or data-transforming migration is normally restoring the pre-migration backup and redeploying the matching application version, not selectively dropping columns or tables after new writes have occurred.
