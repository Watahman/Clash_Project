import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rawUrl = String(process.env.SUPABASE_DB_URL || '').trim();
if (!rawUrl) {
  console.error('Missing SUPABASE_DB_URL. Set it to a PostgreSQL connection URL for the target Supabase database.');
  process.exit(2);
}

let url;
try {
  url = new URL(rawUrl);
} catch {
  console.error('SUPABASE_DB_URL is not a valid PostgreSQL URL.');
  process.exit(2);
}

if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
  console.error('SUPABASE_DB_URL must use postgres:// or postgresql://.');
  process.exit(2);
}

const sqlPath = fileURLToPath(new URL('./check-advanced-stats-schema.sql', import.meta.url));
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
  PGSSLMODE: url.searchParams.get('sslmode') || 'require',
};

const result = spawnSync(
  'psql',
  ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', sqlPath],
  { env, stdio: 'inherit' },
);

if (result.error?.code === 'ENOENT') {
  console.error('psql was not found. Install the PostgreSQL client or run scripts/check-advanced-stats-schema.sql in the Supabase SQL editor.');
  process.exit(2);
}
if (result.error) {
  console.error(`Could not run Advanced Stats schema verification: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
