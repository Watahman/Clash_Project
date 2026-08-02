import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'src');

async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(async entry => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(fullPath) : [fullPath];
    }))).flat();
}

const files = await walk(sourceRoot);
const jpegFiles = files.filter(file => /\.jpe?g$/i.test(file));
const optimizedPaths = new Map();

for (const jpegPath of jpegFiles) {
    const source = await readFile(jpegPath);
    const fingerprint = createHash('sha256').update(source).digest('hex').slice(0, 10);
    const avifPath = jpegPath.replace(/\.jpe?g$/i, `.${fingerprint}.avif`);
    await sharp(jpegPath).avif({ quality: 58, effort: 5 }).toFile(avifPath);
    optimizedPaths.set(jpegPath, avifPath);
}

const textFiles = files.filter(file => /\.(?:html|css|js)$/i.test(file));
for (const file of textFiles) {
    let content = await readFile(file, 'utf8');
    for (const [jpegPath, avifPath] of optimizedPaths) {
        const sourceUrl = `/${path.relative(sourceRoot, jpegPath).replaceAll(path.sep, '/')}`;
        const outputUrl = `/${path.relative(sourceRoot, avifPath).replaceAll(path.sep, '/')}`;
        const previousWebpUrl = sourceUrl.replace(/\.jpe?g$/i, '.webp');
        content = content.replaceAll(sourceUrl, outputUrl).replaceAll(previousWebpUrl, outputUrl)
            .replace(new RegExp(sourceUrl.replace(/\.jpe?g$/i, '\\.[0-9a-f]{10}\\.webp').replaceAll('/', '\\/'), 'g'), outputUrl);
    }
    await writeFile(file, content, 'utf8');
}

const htmlFiles = files.filter(file => /\.html$/i.test(file));
for (const htmlPath of htmlFiles) {
    let html = await readFile(htmlPath, 'utf8');
    const matches = [...html.matchAll(/<img\b[^>]*\bsrc=["'](\/[^"']+)["'][^>]*>/gi)];
    for (const match of matches.reverse()) {
        if (/\bwidth=["']|\bheight=["']/i.test(match[0])) continue;
        const assetPath = path.join(sourceRoot, match[1].replace(/^\//, '').replaceAll('/', path.sep));
        try {
            const metadata = await sharp(assetPath).metadata();
            if (!metadata.width || !metadata.height) continue;
            const replacement = match[0].replace(/>$/, ` width="${metadata.width}" height="${metadata.height}">`);
            html = `${html.slice(0, match.index)}${replacement}${html.slice(match.index + match[0].length)}`;
        } catch {
            // Remote, generated, or optional assets are intentionally left untouched.
        }
    }
    await writeFile(htmlPath, html, 'utf8');
}

console.log(`Optimized ${jpegFiles.length} JPEG images as AVIF and added intrinsic image dimensions.`);
