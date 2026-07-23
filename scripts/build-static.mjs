import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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

const publicSiteUrl = String(process.env.PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
if (publicSiteUrl) {
    const parsedUrl = new URL(publicSiteUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
        throw new Error('PUBLIC_SITE_URL must be an absolute HTTP(S) URL.');
    }
    for (const name of ['robots.txt', 'sitemap.xml']) {
        const file = resolve(output, name);
        const content = await readFile(file, 'utf8');
        await writeFile(
            file,
            content.replaceAll('https://replace-with-production-domain.invalid', publicSiteUrl),
            'utf8'
        );
    }
} else {
    console.warn('PUBLIC_SITE_URL is not set; robots.txt and sitemap.xml retain the non-production placeholder.');
}

console.log(`Copied the complete static application from ${source} to ${output}.`);
