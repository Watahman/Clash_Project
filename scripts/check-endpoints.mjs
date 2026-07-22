import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function sourceFiles(directory, extension) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sourceFiles(path, extension);
        return entry.name.endsWith(extension) ? [path] : [];
    }));
    return nested.flat();
}

function extract(source, pattern) {
    return new Map([...source.matchAll(pattern)].map(match => [match[1], match[2]]));
}

const javaConfig = await readFile('src/Java/Config.java', 'utf8');
const frontendConfig = await readFile('src/assets/js/Data/config.js', 'utf8');
const javaSources = (await Promise.all((await sourceFiles('src/Java', '.java')).map(path => readFile(path, 'utf8')))).join('\n');
const frontendSources = (await Promise.all((await sourceFiles('src/assets/js', '.js')).map(path => readFile(path, 'utf8')))).join('\n');

const normalizedJavaEndpoints = new Map(
    [...javaConfig.matchAll(/String\s+((_EXT|_AUTH)_[A-Z0-9_]+)\s*=\s*"([^"]+)"/g)]
        .map(match => [match[1], match[3]])
);
const frontendEndpoints = extract(frontendConfig, /export const\s+(_EXT_[A-Z0-9_]+)\s*=\s*"([^"]+)"/g);
const registered = new Set([...javaSources.matchAll(/createContext\((?:conf|config)\.((_EXT|_AUTH)_[A-Z0-9_]+)/g)].map(match => match[1]));
const usedFrontendConstants = new Set([...frontendSources.matchAll(/config\.(_EXT_[A-Z0-9_]+)/g)].map(match => match[1]));
const usedAuthPaths = new Set([...frontendSources.matchAll(/authEndpoint\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]));
const errors = [];

for (const [name, path] of frontendEndpoints) {
    if (!normalizedJavaEndpoints.has(name)) errors.push(`${name} is missing in Java config.`);
    else if (normalizedJavaEndpoints.get(name) !== path) errors.push(`${name} path differs between Java and frontend.`);
}

for (const name of usedFrontendConstants) {
    if (!frontendEndpoints.has(name)) errors.push(`${name} is used by frontend code but missing in frontend config.`);
    if (!registered.has(name)) errors.push(`${name} is used by frontend code but has no registered Java route.`);
}

for (const path of usedAuthPaths) {
    const route = [...normalizedJavaEndpoints].find(([name, value]) => name.startsWith('_AUTH_') && value === path);
    if (!route) errors.push(`${path} is used by auth-client.js but missing in Java config.`);
    else if (!registered.has(route[0])) errors.push(`${path} is used by auth-client.js but its Java route is not registered.`);
}

for (const name of registered) {
    if (!normalizedJavaEndpoints.has(name)) errors.push(`${name} is registered but missing in Java config.`);
}

if (errors.length) throw new Error(errors.join('\n'));
console.log(`Validated ${usedFrontendConstants.size} frontend data routes and ${usedAuthPaths.size} auth routes against registered Java handlers.`);
