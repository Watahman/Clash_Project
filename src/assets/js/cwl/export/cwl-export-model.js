import { normalizePlanDocument, normalizeRosterStatus } from '../cwl-plan-schema.js';

const ROLE_ORDER = Object.freeze({ core: 0, rotation: 1, reserve: 2 });
const DEFAULT_VISIBILITY = Object.freeze({
    playerNames: true,
    townHallLevels: true,
    playerTags: false,
    rosterRoles: true
});

export const DEFAULT_EXPORT_OPTIONS = Object.freeze({
    scope: 'complete',
    clanId: '',
    clanTag: '',
    showNames: true,
    showTownHall: true,
    showTags: false,
    showRoles: true,
    showPlayerNames: true,
    showTownHallLevels: true,
    showPlayerTags: false,
    showRosterRoles: true
});

function sourceDocument(snapshot) {
    return snapshot?.info && typeof snapshot.info === 'object'
        ? snapshot.info
        : snapshot;
}

function snapshotName(snapshot) {
    return String(snapshot?.name || 'Untitled plan').trim() || 'Untitled plan';
}

function normalizeScope(options) {
    const value = String(options.scope || options.mode || 'complete').toLowerCase();
    return ['single', 'single-clan', 'clan'].includes(value) ? 'single' : 'complete';
}

function overrideValue(overrides, keys) {
    const key = keys.find(candidate => Object.prototype.hasOwnProperty.call(overrides, candidate));
    return key ? overrides[key] : undefined;
}

function normalizeVisibility(options, overrides = {}) {
    const nested = options.visibility && typeof options.visibility === 'object'
        ? options.visibility
        : {};
    return {
        playerNames: Boolean(nested.playerNames ?? overrideValue(overrides, ['playerNames', 'showNames', 'showPlayerNames'])
            ?? options.playerNames ?? options.showNames ?? options.showPlayerNames
            ?? DEFAULT_VISIBILITY.playerNames),
        townHallLevels: Boolean(nested.townHallLevels ?? overrideValue(overrides, ['townHallLevels', 'showTownHall', 'showTownHallLevels'])
            ?? options.townHallLevels ?? options.showTownHall ?? options.showTownHallLevels
            ?? DEFAULT_VISIBILITY.townHallLevels),
        playerTags: Boolean(nested.playerTags ?? overrideValue(overrides, ['playerTags', 'showTags', 'showPlayerTags'])
            ?? options.playerTags ?? options.showTags ?? options.showPlayerTags
            ?? DEFAULT_VISIBILITY.playerTags),
        rosterRoles: Boolean(nested.rosterRoles ?? overrideValue(overrides, ['rosterRoles', 'showRoles', 'showRosterRoles'])
            ?? options.rosterRoles ?? options.showRoles ?? options.showRosterRoles
            ?? DEFAULT_VISIBILITY.rosterRoles)
    };
}

function findSelectedClan(clans, options) {
    const wanted = String(
        options.clanId || options.selectedClanId || options.clanTag || options.selectedClanTag || ''
    ).trim();
    if (!wanted) return null;
    const normalized = wanted.toUpperCase();
    return clans.find(clan => clan.id === wanted
        || clan.tag.toUpperCase() === normalized
        || clan.name.toUpperCase() === normalized) || null;
}

function playerView(player, clanName = '') {
    const result = {
        name: String(player.name || player.tag).trim(),
        tag: String(player.tag || '').trim(),
        townHallLevel: Number(player.townHallLevel) || 1,
        rosterStatus: normalizeRosterStatus(player.rosterStatus),
        clanName: String(player.clanName || clanName).trim(),
        clanTag: String(player.clanTag || '').trim()
    };
    if (Array.isArray(player.plannedDays)) result.plannedDays = [...player.plannedDays];
    return result;
}

function comparePlayers(left, right) {
    return (ROLE_ORDER[left.rosterStatus] ?? 3) - (ROLE_ORDER[right.rosterStatus] ?? 3)
        || left.name.localeCompare(right.name)
        || left.tag.localeCompare(right.tag);
}

function countRoles(players) {
    return players.reduce((counts, player) => {
        if (player.rosterStatus in ROLE_ORDER) counts[player.rosterStatus] += 1;
        return counts;
    }, { core: 0, rotation: 0, reserve: 0 });
}

function clanView(clan) {
    const players = clan.players.map(player => playerView(player, clan.name)).sort(comparePlayers);
    return {
        id: String(clan.id || '').trim(),
        name: String(clan.name || clan.tag).trim(),
        tag: String(clan.tag || '').trim(),
        capacity: Number(clan.capacity) || 15,
        badgeUrl: String(clan.badgeUrl || '').trim(),
        players,
        assignedPlayers: players.length,
        assignedCount: players.length,
        roleCounts: countRoles(players)
    };
}

function selectedClans(document, scope, options) {
    const selected = findSelectedClan(document.clans, options);
    const source = scope === 'single'
        ? (selected ? [selected] : [])
        : document.clans;
    return {
        selected,
        clans: source.map(clanView)
    };
}

function modelTotals(clans, freePlayers) {
    return {
        clans: clans.length,
        assignedPlayers: clans.reduce((total, clan) => total + clan.assignedPlayers, 0),
        unassignedPlayers: freePlayers.length
    };
}

function freezeDeep(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    Object.values(value).forEach(child => freezeDeep(child, seen));
    return Object.freeze(value);
}

export function createCwlExportViewModel(snapshot, options = {}) {
    const mergedOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const normalized = normalizePlanDocument(sourceDocument(snapshot));
    const scope = normalizeScope(mergedOptions);
    const selection = selectedClans(normalized, scope, mergedOptions);
    const { clans, selected: selectedClan } = selection;
    const freePlayers = scope === 'single'
        ? []
        : normalized.freePlayers.map(player => playerView(player)).sort(comparePlayers);
    const visibility = normalizeVisibility(mergedOptions, options || {});

    return freezeDeep({
        name: snapshotName(snapshot),
        exportedAt: String(snapshot?.exportedAt || '').trim(),
        scope,
        mode: scope === 'single' ? 'single-clan' : 'complete',
        selectedClanId: selectedClan?.id || null,
        selectedClanTag: selectedClan?.tag || null,
        visibility,
        planName: snapshotName(snapshot),
        showNames: visibility.playerNames,
        showTownHall: visibility.townHallLevels,
        showTags: visibility.playerTags,
        showRoles: visibility.rosterRoles,
        clans,
        freePlayers,
        unassigned: freePlayers,
        totals: modelTotals(clans, freePlayers)
    });
}

function safeSlug(value, fallback) {
    const slug = String(value || '')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return slug || fallback;
}

export function safeExportFilename(name, extension, suffix = '') {
    const requestedExtension = String(extension || '').trim();
    const ext = requestedExtension.replace(/^\.+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const safeSuffix = String(suffix || '')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '');
    const suffixPart = safeSuffix ? `-${safeSuffix}` : '';
    const base = safeSlug(name, 'Plan');
    const prefix = base.toLowerCase().startsWith('clashpanel-') ? '' : 'ClashPanel-';
    return `${prefix}${base}${suffixPart}${ext ? `.${ext}` : ''}`;
}
