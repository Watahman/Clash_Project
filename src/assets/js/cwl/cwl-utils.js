export function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

export function getPlayerTag(player) {
    return normalizeTag(player?.tag || player?.playerTag || player?.accountTag || player?.clashTag);
}

export function normalizePlayer(player, fallbackClanName = '') {
    const tag = getPlayerTag(player);
    if (!tag) return null;
    return {
        ...player,
        tag,
        name: player?.name || player?.playerName || player?.accountName || tag,
        clanName: player?.clanName || player?.clan?.name || fallbackClanName || 'No clan',
        townHallLevel: Number(player?.townHallLevel || player?.townHall || player?.townhall || player?.th || 1)
    };
}

export function uniquePlayers(players, fallbackClanName = '') {
    const seen = new Set();
    const unique = [];
    (Array.isArray(players) ? players : [players]).forEach(player => {
        const normalized = normalizePlayer(player, fallbackClanName);
        if (!normalized || seen.has(normalized.tag)) return;
        seen.add(normalized.tag);
        unique.push(normalized);
    });
    return unique;
}

export function getCardTag(card) {
    return normalizeTag(card?.dataset?.playerTag || card?.querySelector?.('.cwl-player-hashtag')?.textContent);
}

export function plannerHasPlayer(tag) {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) return false;
    return Boolean(document.querySelector(`.cwl-player-article[data-planner-card="true"][data-player-tag="${CSS.escape(normalizedTag)}"]`));
}
