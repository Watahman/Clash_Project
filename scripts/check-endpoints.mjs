import { readFile } from 'node:fs/promises';

const java = await readFile('src/Java/Config.java', 'utf8');
const frontend = await readFile('src/assets/js/Data/config.js', 'utf8');

function extract(source, pattern) {
    return new Map([...source.matchAll(pattern)].map(match => [match[1], match[2]]));
}

const javaEndpoints = extract(java, /String\s+(_EXT_[A-Z0-9_]+)\s*=\s*"([^"]+)"/g);
const frontendEndpoints = extract(frontend, /export const\s+(_EXT_[A-Z0-9_]+)\s*=\s*"([^"]+)"/g);
const errors = [];

for (const [name, path] of javaEndpoints) {
    if (!frontendEndpoints.has(name)) errors.push(`${name} is missing in frontend config.`);
    else if (frontendEndpoints.get(name) !== path) errors.push(`${name} path differs between Java and frontend.`);
}
for (const name of frontendEndpoints.keys()) {
    if (!javaEndpoints.has(name)) errors.push(`${name} is missing in Java config.`);
}

if (errors.length) throw new Error(errors.join('\n'));
console.log(`Validated ${javaEndpoints.size} matching frontend/backend endpoint constants.`);
