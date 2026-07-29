import { execFileSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .map(path => path.trim())
    .filter(Boolean);

const pathsByLowercase = new Map();
for (const file of files) {
    const normalized = file.replaceAll('\\', '/');
    const key = normalized.toLocaleLowerCase('en-US');
    const matches = pathsByLowercase.get(key) || [];
    matches.push(normalized);
    pathsByLowercase.set(key, matches);
}

const collisions = [...pathsByLowercase.values()].filter(matches => matches.length > 1);
if (collisions.length) {
    throw new Error(
        `Case-insensitive filename collisions found:\n${collisions
            .map(matches => `- ${matches.join(' <> ')}`)
            .join('\n')}`
    );
}

console.log(`Validated casing uniqueness for ${files.length} tracked files.`);
