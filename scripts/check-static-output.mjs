import { readdir } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

const output = resolve('dist');

async function filesBelow(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? filesBelow(path) : [path];
    }));
    return nested.flat();
}

const files = await filesBelow(output);
const forbidden = files
    .map(file => relative(output, file).replaceAll('\\', '/'))
    .filter(file => file.startsWith('Java/')
        || extname(file).toLowerCase() === '.java'
        || file === 'REDESIGN_NOTES.txt'
        || /(^|\/)\.env(?:\.|$)/i.test(file));

if (forbidden.length) {
    throw new Error(`Forbidden server-side files found in dist:\n${forbidden.join('\n')}`);
}

console.log(`Validated ${files.length} public static files without backend sources or environment files.`);
