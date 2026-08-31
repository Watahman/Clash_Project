import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';

const API = 'https://clashofclans.fandom.com/api.php';
const SOURCE_PAGE = 'https://clashofclans.fandom.com/wiki/Scenery';
const USER_AGENT = 'ClashPanel-SceneryScout/1.0 (fan-made catalog; contact via clashpanel.com)';
const ROOT = resolve('src/assets/scenery-scout');
const SOURCES = resolve(ROOT, 'sources');
const GENERATED = resolve(ROOT, 'generated');
const ORIGINAL_MAX = 2560;
const CROP_WIDTH = 960;
const CROP_HEIGHT = 600;

const CROP_SPECS = Object.freeze([
    ['top-left', .02, .03, .38, 'normal'],
    ['top', .50, .03, .34, 'normal'],
    ['top-right', .98, .03, .30, 'hard'],
    ['right', .98, .50, .27, 'hard'],
    ['bottom-right', .98, .97, .23, 'expert'],
    ['bottom', .50, .97, .36, 'normal'],
    ['bottom-left', .02, .97, .28, 'hard'],
    ['left', .02, .50, .23, 'expert']
]);

const TAG_RULES = Object.freeze([
    ['winter', /winter|snow|frost|gingerbread|jolly|ice/],
    ['dark', /shadow|ghost|spooky|dark|doomed|skeleton|pumpkin|wasteland/],
    ['asian', /tiger|dragon|snake|anime|palace/],
    ['fantasy', /magic|dragon|ghost|books|quest|cosmic|royale/],
    ['nature', /jungle|primal|mountain|wild|forest|desert/],
    ['futuristic', /future|space|cyber|pixel|cosmic|meteor/],
    ['historic', /egypt|medieval|dark-ages|pirate|wild-west|military/],
    ['celebration', /clashiversary|clash-fest|clash-games|clash-a-rama|mash-a-rama/],
    ['colorful', /painter|anime|toy|crossover|football|theatre|glory/],
    ['water', /pirate|high-seas|dragon-palace|summer/]
]);

await rm(SOURCES, { recursive: true, force: true });
await mkdir(SOURCES, { recursive: true });
await rm(GENERATED, { recursive: true, force: true });
await mkdir(GENERATED, { recursive: true });

const retrievedAt = new Date().toISOString();
const wikitext = await fetchWikitext();
const gallery = parseHomeVillageGallery(wikitext);
const metadata = await fetchImageMetadata(gallery.map(item => item.file));
const sceneries = [];
const failures = [];

for (const item of gallery) {
    const info = metadata.get(normalizeTitle(item.file));
    if (!info?.url) {
        failures.push({ name: item.name, file: item.file, reason: 'metadata-missing' });
        continue;
    }
    try {
        sceneries.push(await acquireScenery(item, info, retrievedAt));
        process.stdout.write(`Acquired ${item.name}\n`);
    } catch (error) {
        failures.push({ name: item.name, file: item.file, reason: error.message });
    }
}

const manifest = {
    schemaVersion: 1,
    catalogRevision: createHash('sha256').update(gallery.map(item => item.file).join('\n')).digest('hex').slice(0, 16),
    retrievedAt,
    sourcePage: SOURCE_PAGE,
    count: sceneries.length,
    sceneries
};
const report = {
    discovered: gallery.length,
    acquired: sceneries.length,
    missing: failures.length,
    generatedCrops: sceneries.reduce((sum, scenery) => sum + scenery.crops.length, 0),
    sourceBytes: sceneries.reduce((sum, scenery) => sum + scenery.asset.bytes, 0),
    failures
};

await writeJson(resolve(ROOT, 'scenery-manifest.json'), manifest);
await writeJson(resolve(ROOT, 'acquisition-report.json'), report);
if (failures.length) process.exitCode = 1;
console.log(JSON.stringify(report, null, 2));

async function fetchWikitext() {
    const url = new URL(API);
    url.search = new URLSearchParams({ action: 'parse', page: 'Scenery', prop: 'wikitext', format: 'json', origin: '*' });
    const payload = await fetchJson(url);
    return payload?.parse?.wikitext?.['*'] || '';
}

function parseHomeVillageGallery(wikitext) {
    const section = wikitext.split('===Scenery Gallery===')[1]?.split('</gallery>')[0] || '';
    const entries = section.split('\n').map(parseGalleryLine).filter(Boolean);
    const unique = new Map();
    for (const entry of entries) {
        const key = slugify(entry.name.replace(/\s+Scenery$/i, ''));
        if (!unique.has(key) || /zoomed out/i.test(entry.caption)) unique.set(key, { ...entry, id: key });
    }
    if (unique.size < 50) throw new Error(`Unexpected scenery gallery size: ${unique.size}`);
    return [...unique.values()];
}

function parseGalleryLine(line) {
    const [rawFile, rawCaption] = line.trim().split('|');
    if (!rawFile || !rawCaption || /^<|^File:\s*$/i.test(rawFile)) return null;
    const file = rawFile.replace(/^File:/i, '').trim();
    const caption = rawCaption.trim();
    const name = caption
        .replace(/\s*\((normal|autumn variant|winter variant|zoomed out|zoomed in)\)\s*/ig, '')
        .replace(/\s+Scenery$/i, '')
        .trim();
    return { file, caption, name: `${name} Scenery`.replace(/^Books of Clash Scenery$/, 'Books of Clash Scenery') };
}

async function fetchImageMetadata(files) {
    const result = new Map();
    for (let index = 0; index < files.length; index += 50) {
        const titles = files.slice(index, index + 50).map(file => `File:${file}`).join('|');
        const url = new URL(API);
        url.search = new URLSearchParams({ action: 'query', titles, prop: 'imageinfo', iiprop: 'url|size|mime|sha1|timestamp', format: 'json', origin: '*' });
        const payload = await fetchJson(url);
        for (const page of Object.values(payload?.query?.pages || {})) {
            const info = page.imageinfo?.[0];
            if (info) result.set(normalizeTitle(page.title), info);
        }
    }
    return result;
}

async function acquireScenery(item, info, retrievedAt) {
    const response = await fetch(`${info.url}${info.url.includes('?') ? '&' : '?'}format=original`, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`download-${response.status}`);
    const original = Buffer.from(await response.arrayBuffer());
    const sourcePath = resolve(SOURCES, `${item.id}.webp`);
    await sharp(original).rotate().resize({ width: ORIGINAL_MAX, height: ORIGINAL_MAX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, effort: 5 }).toFile(sourcePath);
    const sourceBuffer = await readFile(sourcePath);
    const sourceMeta = await sharp(sourceBuffer).metadata();
    const crops = await generateCrops(item.id, sourcePath, sourceMeta);
    return {
        id: item.id,
        name: item.name,
        type: 'home',
        active: crops.length === CROP_SPECS.length,
        tags: inferTags(item.id),
        sourceImage: `/assets/scenery-scout/sources/${item.id}.webp`,
        asset: {
            width: sourceMeta.width,
            height: sourceMeta.height,
            bytes: sourceBuffer.byteLength,
            sha256: sha256(sourceBuffer)
        },
        source: {
            provider: 'clash-of-clans-wiki',
            page: SOURCE_PAGE,
            filePage: info.descriptionurl,
            originalFileUrl: info.url,
            upstreamSha1: info.sha1,
            upstreamWidth: info.width,
            upstreamHeight: info.height,
            upstreamMime: info.mime,
            upstreamTimestamp: info.timestamp,
            retrievedAt
        },
        crops
    };
}

async function generateCrops(id, sourcePath, meta) {
    const directory = resolve(GENERATED, id);
    await mkdir(directory, { recursive: true });
    const crops = [];
    for (const [region, anchorX, anchorY, scale, difficulty] of CROP_SPECS) {
        const width = Math.min(meta.width, Math.round(meta.width * scale));
        const height = Math.min(meta.height, Math.round(width * CROP_HEIGHT / CROP_WIDTH));
        const left = Math.round((meta.width - width) * anchorX);
        const top = Math.round((meta.height - height) * anchorY);
        const cropId = `${id}-${region}`;
        const filePath = resolve(directory, `${region}.webp`);
        await sharp(sourcePath).extract({ left, top, width, height }).resize(CROP_WIDTH, CROP_HEIGHT, { fit: 'cover' })
            .webp({ quality: 80, effort: 5 }).toFile(filePath);
        crops.push({
            id: cropId,
            region,
            difficulty,
            image: `/assets/scenery-scout/generated/${id}/${region}.webp`,
            x: round(left / meta.width), y: round(top / meta.height),
            width: round(width / meta.width), height: round(height / meta.height),
            enabled: true
        });
    }
    return crops;
}

function inferTags(id) {
    const tags = ['home'];
    for (const [tag, pattern] of TAG_RULES) if (pattern.test(id)) tags.push(tag);
    return tags.length > 1 ? tags : [...tags, 'themed'];
}

async function fetchJson(url) {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`Fandom API returned ${response.status}`);
    return response.json();
}

function slugify(value) {
    return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeTitle(value) {
    return `File:${value.replace(/^File:/i, '').replace(/_/g, ' ')}`.toLowerCase();
}

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

function round(value) {
    return Number(value.toFixed(5));
}

async function writeJson(path, value) {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
