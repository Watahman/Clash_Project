import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderRobots, renderSitemap } from './public-routes.mjs';

const source = resolve('src');
const output = resolve('dist');

if (source === output || !output.endsWith(`${process.platform === 'win32' ? '\\' : '/'}dist`)) {
    throw new Error(`Unsafe static output directory: ${output}`);
}

await stat(source);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });
await rm(resolve(output, 'Java'), { recursive: true, force: true });
await rm(resolve(output, 'REDESIGN_NOTES.txt'), { force: true });

const publicSiteUrl = String(
    process.env.PUBLIC_SITE_URL || 'https://clashpanel.com'
).trim().replace(/\/+$/, '');

if (publicSiteUrl) {
    const parsedUrl = new URL(publicSiteUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
        throw new Error('PUBLIC_SITE_URL must be an absolute HTTP(S) URL.');
    }
    await writeFile(resolve(output, 'robots.txt'), renderRobots(publicSiteUrl), 'utf8');
    await writeFile(resolve(output, 'sitemap.xml'), renderSitemap(publicSiteUrl), 'utf8');
} else {
    throw new Error('PUBLIC_SITE_URL must resolve to the canonical production origin.');
}

for (const name of ['robots.txt', 'sitemap.xml']) {
    const content = await readFile(resolve(output, name), 'utf8');
    if (content.includes('replace-with-production-domain.invalid')) {
        throw new Error(`${name} contains a placeholder production domain.`);
    }
}

console.log(`Copied the complete static application from ${source} to ${output}.`);
