import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('src');
const output = resolve('dist');

if (source === output || !output.endsWith(`${process.platform === 'win32' ? '\\' : '/'}dist`)) {
    throw new Error(`Unsafe static output directory: ${output}`);
}

await stat(source);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

console.log(`Copied the complete static application from ${source} to ${output}.`);
