/*
 * The catalog keeps separate IDs when one game entity has two gameplay
 * roles. The central manifest stores one canonical image for that entity.
 * Keep this small map at the minigame boundary so the shared asset resolver
 * and collected asset pack remain unchanged.
 */
const CANONICAL_ASSET_IDS = Object.freeze({
    'builders-hut-defense': 'builders-hut',
    'builders-hut-utility': 'builders-hut'
});

function entityId(entity) {
    return typeof entity === 'object' && entity
        ? entity.id || entity.name
        : entity;
}

export function resolveMinigameAssetEntity(entity) {
    if (!entity) return entity;
    const id = String(entityId(entity) || '').trim().toLowerCase();
    const canonicalId = CANONICAL_ASSET_IDS[id];
    if (!canonicalId) return entity;

    return typeof entity === 'object'
        ? { ...entity, id: canonicalId }
        : canonicalId;
}
