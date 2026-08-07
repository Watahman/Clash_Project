import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rawUrl = String(process.env.SUPABASE_DB_URL || '').trim();
if (!rawUrl) {
  console.error('Missing SUPABASE_DB_URL. Set it to the target Supabase PostgreSQL connection URL.');
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

const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
  PGSSLMODE: url.searchParams.get('sslmode') || 'require',
};

const scripts = [
  'check-advanced-stats-schema.sql',
  'smoke-test-advanced-stats-db.sql',
  'smoke-test-advanced-stats-state-machine.sql',
  'smoke-test-advanced-stats-read-models.sql',
  'smoke-test-advanced-stats-constraints.sql',
  'smoke-test-advanced-stats-cascades.sql',
];

for (const name of scripts) {
  const path = fileURLToPath(new URL(`./${name}`, import.meta.url));
  console.log(`\n=== Advanced Stats DB: ${name} ===`);
  const result = spawnSync(
    'psql',
    ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', path],
    { env, stdio: 'inherit' },
  );

  if (result.error?.code === 'ENOENT') {
    console.error('psql was not found. Install the PostgreSQL client or run the SQL scripts in the Supabase SQL editor.');
    process.exit(2);
  }
  if (result.error) {
    console.error(`Could not run ${name}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${name} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nAdvanced Stats database verification and rollback smoke suite: PASS');
