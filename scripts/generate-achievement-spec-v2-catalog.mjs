import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const EXPECTED_FAMILY_COUNT = 340;
const EXPECTED_FIXED_TIER_COUNT = 1331;
const EXPECTED_SEED_SHA256 = 'B3346AFECE17B36AE33BA3DED4F1183BD9226AFEA3145B23046E9EED97C69939';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, '..');
const TARGET_PATH = resolve(REPOSITORY_ROOT, 'src/Java/achievements/AchievementSpecV2Catalog.java');

function required(value, label) {
    if (value === undefined || value === null) {
        throw new Error(`Missing required achievement spec value: ${label}`);
    }
    return value;
}

function thresholdText(value) {
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
            : String(value);
    }
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

function generatedNotes(achievement) {
    return [
        String(achievement.notes || '').trim(),
        achievement.confidence ? `Confidence: ${achievement.confidence}.` : ''
    ].filter(Boolean).join(' ');
}

function catalogFamily(achievement) {
    return {
        id: required(achievement.id, 'achievement.id'),
        name: required(achievement.name, `${achievement.id}.name`),
        scope: required(achievement.scope, `${achievement.id}.scope`),
        category: required(achievement.category, `${achievement.id}.category`),
        description: required(achievement.description, `${achievement.id}.description`),
        metric: required(achievement.metric, `${achievement.id}.metric`),
        sourceCodes: required(achievement.sources, `${achievement.id}.sources`),
        evaluationMode: required(achievement.mode, `${achievement.id}.mode`),
        priority: required(achievement.priority, `${achievement.id}.priority`),
        notes: generatedNotes(achievement),
        tiers: required(achievement.tiers, `${achievement.id}.tiers`).map(tier => ({
            tier: required(tier.tier, `${achievement.id}.tier`),
            label: required(tier.label, `${achievement.id}.tier.${tier.tier}.label`),
            threshold: required(tier.threshold, `${achievement.id}.tier.${tier.tier}.threshold`),
            thresholdText: thresholdText(tier.threshold),
            rarity: String(required(tier.rarity, `${achievement.id}.tier.${tier.tier}.rarity`)).toLowerCase(),
            xp: required(tier.xp, `${achievement.id}.tier.${tier.tier}.xp`)
        }))
    };
}

function wrapBase64(value, width = 120) {
    return value.match(new RegExp(`.{1,${width}}`, 'g')).join('\n');
}

const seedPath = process.argv[2];
if (!seedPath) {
    throw new Error('Usage: node scripts/generate-achievement-spec-v2-catalog.mjs <ClashPanel_Achievements_Seed_v2.json>');
}

const seedBytes = readFileSync(resolve(seedPath));
const seedHash = createHash('sha256').update(seedBytes).digest('hex').toUpperCase();
if (seedHash !== EXPECTED_SEED_SHA256) {
    throw new Error(`Achievement v2 seed checksum mismatch: expected ${EXPECTED_SEED_SHA256}, found ${seedHash}`);
}

const seed = JSON.parse(seedBytes.toString('utf8'));
const families = required(seed.achievements, 'achievements').map(catalogFamily);
const fixedTierCount = families.reduce((total, family) => total + family.tiers.length, 0);
const declaredFamilyCount = Number(seed.summary?.custom_families);
const declaredFixedTierCount = Number(seed.summary?.fixed_unlockable_tiers);

if (seed.schema_version !== '2.0') {
    throw new Error(`Expected achievement seed schema 2.0, found ${seed.schema_version || 'none'}`);
}
if (declaredFamilyCount !== EXPECTED_FAMILY_COUNT || families.length !== EXPECTED_FAMILY_COUNT) {
    throw new Error(`Expected ${EXPECTED_FAMILY_COUNT} families, found declared=${declaredFamilyCount}, actual=${families.length}`);
}
if (declaredFixedTierCount !== EXPECTED_FIXED_TIER_COUNT || fixedTierCount !== EXPECTED_FIXED_TIER_COUNT) {
    throw new Error(`Expected ${EXPECTED_FIXED_TIER_COUNT} tiers, found declared=${declaredFixedTierCount}, actual=${fixedTierCount}`);
}

const payload = JSON.stringify({
    version: seed.schema_version,
    familyCount: families.length,
    fixedTierCount,
    families
});
const encoded = wrapBase64(gzipSync(Buffer.from(payload, 'utf8'), { level: 9, mtime: 0 }).toString('base64'));

const source = readFileSync(TARGET_PATH, 'utf8');
const eol = source.includes('\r\n') ? '\r\n' : '\n';
const replacement = `private static final String GZIP_BASE64 = """${eol}${encoded.replaceAll('\n', eol)}${eol}""";`;
const pattern = /private static final String GZIP_BASE64 = """[\s\S]*?""";/;
if (!pattern.test(source)) {
    throw new Error(`Could not find GZIP_BASE64 in ${TARGET_PATH}`);
}

writeFileSync(TARGET_PATH, source.replace(pattern, replacement), 'utf8');
console.log(`Generated ${families.length} achievement families and ${fixedTierCount} fixed tiers.`);
