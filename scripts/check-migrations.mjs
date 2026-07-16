import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve('database/migrations');
const files = (await readdir(directory))
    .filter(file => file.endsWith('.sql'))
    .sort();

if (!files.length) throw new Error('No SQL migrations found.');
if (new Set(files).size !== files.length) throw new Error('Duplicate migration filenames found.');

for (const file of files) {
    const sql = await readFile(resolve(directory, file), 'utf8');
    if (!sql.trim()) throw new Error(`${file} is empty.`);
    if ((sql.match(/\$\$/g) || []).length % 2 !== 0) {
        throw new Error(`${file} contains an unbalanced dollar-quoted block.`);
    }
    if (/service_role\s*=\s*['"][^'"]+['"]/i.test(sql)) {
        throw new Error(`${file} appears to contain an embedded service-role value.`);
    }
}

const requiredOrder = [
    '20260716_001_auth_profiles_and_core_rls.sql',
    '20260716_002_accounts_polls_notifications.sql',
    '20260716_003_persistent_api_cache.sql',
    '20260716_004_poll_transactions_and_reminders.sql'
];
let lastIndex = -1;
for (const required of requiredOrder) {
    const index = files.indexOf(required);
    if (index < 0 || index <= lastIndex) throw new Error(`Missing or misordered migration: ${required}`);
    lastIndex = index;
}

console.log(`Validated ${files.length} ordered SQL migration files.`);
