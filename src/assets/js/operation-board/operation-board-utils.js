import { normalizeWarState } from '../cwl/cwl-war-state.js';

export function normalizeTag(value = '') {
    const source = typeof value === 'object' && value !== null
        ? (value.tag || value.playerTag || value.player_tag || value.hashtag
            || value.clanTag || value.clantag || '')
        : value;
    const clean = String(source || '').trim().toUpperCase();
    if (!clean || ['#NONE', 'NONE', '#0', '0'].includes(clean)) return '';
    return clean.startsWith('#') ? clean : `#${clean}`;
}

export function lower(value = '') {
    return String(value || '').toLowerCase();
}

export function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function looksLikeClashTag(value = '') {
    const raw = String(value || '').trim().toUpperCase().replace(/^#/, '');
    return raw.length >= 3
        && raw.length <= 15
        && /^[0289PYLQGRJCUV]+$/.test(raw);
}

export function looksLikeTechnicalId(value = '') {
    const text = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
        || /^[0-9a-f]{24,}$/i.test(text)
        || lower(text).startsWith('clanid');
}

export function cleanDisplayName(name = '') {
    const text = String(name || '').trim();
    return looksLikeTechnicalId(text) || normalizeTag(text) === text ? '' : text;
}

export function mergePlayerData(base = {}, incoming = {}) {
    return {
        ...base,
        tag: normalizeTag(incoming.tag || base.tag),
        name: cleanDisplayName(incoming.name || incoming.playerName || base.name || ''),
        townHall: number(
            incoming.townHallLevel || incoming.townHall || incoming.th || base.townHall,
            number(base.townHall, 0)
        ),
        clanName: incoming.clanName || incoming.clan?.name || base.clanName || '',
        clanTag: normalizeTag(
            incoming.clanTag || incoming.clantag || incoming.clan?.tag || base.clanTag || ''
        )
    };
}

export function getWarSide(war, clanTag) {
    const selected = normalizeTag(clanTag);
    if (normalizeTag(war?.clan?.tag) === selected) {
        return { self: war.clan, opponent: war.opponent };
    }
    if (normalizeTag(war?.opponent?.tag) === selected) {
        return { self: war.opponent, opponent: war.clan };
    }
    return null;
}

export function normalizeLeaguePhase(state) {
    const normalized = normalizeWarState({ state });
    return ['completed', 'live', 'preparation', 'notStarted'].includes(normalized)
        ? normalized
        : 'unknown';
}

export function escapeHtml(value) {
    return String(value ?? '').replace(
        /[&<>"']/g,
        character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]
    );
}
