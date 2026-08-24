const MANIFEST_URL = '/assets/game/manifest.json';
const ENTITY_FALLBACK = '/assets/placeholders/unavailable-entity.svg';
const ACCOUNT_FALLBACK = '/assets/placeholders/account.svg';
const CLAN_FALLBACK = '/assets/placeholders/clan-badge.svg';

const aliases = Object.freeze({
    'barb king': 'barbarian-king',
    'king': 'barbarian-king',
    'archer queen': 'archer-queen',
    'grand warden': 'grand-warden',
    'royal champion': 'royal-champion',
    'minion prince': 'minion-prince',
    'rage': 'rage-spell',
    'heal': 'healing-spell',
    'jump': 'jump-spell',
    'freeze': 'freeze-spell',
    'invisibility': 'invisibility-spell'
});

const multiplayerLeagues = new Set([
    'archer', 'barbarian', 'dragon', 'electro', 'golem', 'legend', 'pekka',
    'skeleton', 'titan', 'unranked', 'valkyrie', 'witch', 'wizard'
]);

let manifestPromise;

export function normalizeEntityId(value) {
    const raw = typeof value === 'object' && value
        ? value.id || value.name || value.label
        : value;
    const normalized = String(raw || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return aliases[normalized.replace(/-/g, ' ')] || normalized;
}

export async function loadEntityManifest() {
    manifestPromise ||= fetch(MANIFEST_URL, { credentials: 'same-origin' })
        .then(response => {
            if (!response.ok) throw new Error(`Entity manifest unavailable (${response.status})`);
            return response.json();
        })
        .then(data => data?.entities || {});
    return manifestPromise;
}

export async function getEntityAsset(entity) {
    const id = normalizeEntityId(entity);
    const entities = await loadEntityManifest().catch(() => ({}));
    const match = entities[id];
    return match ? { ...match, fallback: false } : {
        id,
        name: typeof entity === 'object' ? entity?.name || id : String(entity || ''),
        category: 'unknown',
        image: ENTITY_FALLBACK,
        fallback: true
    };
}

export function getTownHallAsset(level) {
    const safeLevel = Number.parseInt(level, 10);
    if (!Number.isInteger(safeLevel) || safeLevel < 1 || safeLevel > 18) return ENTITY_FALLBACK;
    return `/assets/game/town-halls/town-hall-${safeLevel}.webp`;
}

export function getLeagueAsset(league) {
    const id = normalizeEntityId(league).replace(/-league(?:-[ivx]+)?$/, '');
    const match = [...multiplayerLeagues].find(name => id === name || id.startsWith(`${name}-`));
    if (!match) return { id, image: ENTITY_FALLBACK, fallback: true };
    return {
        id: match,
        image: `/assets/game/leagues/multiplayer/leagues-${match}.webp`,
        fallback: false
    };
}

export const ASSET_FALLBACKS = Object.freeze({
    entity: ENTITY_FALLBACK,
    account: ACCOUNT_FALLBACK,
    clan: CLAN_FALLBACK
});

export function installImageFallback(image, fallback = ENTITY_FALLBACK) {
    if (!image) return;
    image.addEventListener('error', () => {
        if (image.dataset.fallbackApplied === 'true') return;
        image.dataset.fallbackApplied = 'true';
        image.src = fallback;
    }, { once: true });
}
