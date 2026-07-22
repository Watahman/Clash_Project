export function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

export function escapeCssIdentifier(value) {
    if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
    const input = String(value);
    let escaped = '';
    for (let index = 0; index < input.length; index += 1) {
        const code = input.charCodeAt(index);
        if (code === 0) {
            escaped += '\uFFFD';
        } else if ((code >= 1 && code <= 31) || code === 127
            || (index === 0 && code >= 48 && code <= 57)
            || (index === 1 && code >= 48 && code <= 57 && input.charCodeAt(0) === 45)) {
            escaped += `\\${code.toString(16)} `;
        } else if (index === 0 && code === 45 && input.length === 1) {
            escaped += '\\-';
        } else if (code >= 128 || code === 45 || code === 95
            || (code >= 48 && code <= 57)
            || (code >= 65 && code <= 90)
            || (code >= 97 && code <= 122)) {
            escaped += input.charAt(index);
        } else {
            escaped += `\\${input.charAt(index)}`;
        }
    }
    return escaped;
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
    return Boolean(document.querySelector(`.cwl-player-article[data-planner-card="true"][data-player-tag="${escapeCssIdentifier(normalizedTag)}"]`));
}
