import { normalizePlanDocument } from '../cwl-plan-schema.js';
import { safeExportFilename } from './cwl-export-model.js';

const OVERVIEW_HEADERS = [
    'Plan name',
    'Clan name',
    'Clan tag',
    'Capacity',
    'Assigned players',
    'Core count',
    'Rotation count',
    'Reserve count'
];
const PLAYER_HEADERS = ['Player Name', 'Player Tag', 'Town Hall', 'Role', 'Original Clan'];
const ROLE_LABELS = Object.freeze({ core: 'Core', rotation: 'Rotation', reserve: 'Reserve' });

function sourceDocument(snapshot) {
    return snapshot?.info && typeof snapshot.info === 'object'
        ? snapshot.info
        : snapshot;
}

function normalizedSnapshot(snapshot) {
    return {
        name: String(snapshot?.name || 'Untitled plan').trim() || 'Untitled plan',
        info: normalizePlanDocument(sourceDocument(snapshot))
    };
}

function roleCounts(players) {
    return players.reduce((counts, player) => {
        const role = String(player?.rosterStatus || '').trim().toLowerCase();
        if (role in counts) counts[role] += 1;
        return counts;
    }, { core: 0, rotation: 0, reserve: 0 });
}

function playerRow(player, originalClan = '') {
    return {
        'Player Name': String(player?.name || player?.tag || '').trim(),
        'Player Tag': String(player?.tag || '').trim(),
        'Town Hall': Number(player?.townHallLevel) || 1,
        Role: ROLE_LABELS[String(player?.rosterStatus || '').trim().toLowerCase()] || '',
        'Original Clan': String(player?.clanName || originalClan || '').trim()
    };
}

function clanSheetRows(clan) {
    return clan.players.map(player => playerRow(player, clan.name));
}

function unassignedRows(players) {
    return players.map(player => playerRow(player));
}

function widthFor(header, rows) {
    const longest = rows.reduce((max, row) => Math.max(
        max,
        String(row?.[header] ?? '').length
    ), String(header).length);
    return { wch: Math.min(42, Math.max(12, longest + 2)) };
}

function applyWidths(sheet, headers, rows) {
    sheet['!cols'] = headers.map(header => widthFor(header, rows));
    return sheet;
}

function makeSheet(XLSX, headers, rows) {
    if (typeof XLSX.utils.json_to_sheet === 'function') {
        return applyWidths(XLSX.utils.json_to_sheet(rows, { header: headers }), headers, rows);
    }
    if (typeof XLSX.utils.aoa_to_sheet === 'function') {
        const values = rows.map(row => headers.map(header => row[header] ?? ''));
        return applyWidths(XLSX.utils.aoa_to_sheet([headers, ...values]), headers, rows);
    }
    throw new Error('XLSX.utils.json_to_sheet is unavailable.');
}

function safeSheetName(name, index, used) {
    const initial = String(name || `Clan ${index + 1}`)
        .replace(/[\\/?*\[\]:]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 31) || `Clan ${index + 1}`;
    let candidate = initial;
    let suffix = 2;
    while (used.has(candidate.toLowerCase()) || ['overview', 'unassigned'].includes(candidate.toLowerCase())) {
        const marker = ` (${suffix++})`;
        candidate = `${initial.slice(0, 31 - marker.length)}${marker}`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
}

function overviewRows(name, clans) {
    return clans.map(clan => {
        const counts = roleCounts(clan.players);
        return {
            'Plan name': name,
            'Clan name': clan.name,
            'Clan tag': clan.tag,
            Capacity: Number(clan.capacity) || 15,
            'Assigned players': clan.players.length,
            'Core count': counts.core,
            'Rotation count': counts.rotation,
            'Reserve count': counts.reserve
        };
    });
}

function appendOverview(XLSX, workbook, name, clans, usedNames) {
    XLSX.utils.book_append_sheet(
        workbook,
        makeSheet(XLSX, OVERVIEW_HEADERS, overviewRows(name, clans)),
        'Overview'
    );
    usedNames.add('overview');
}

function appendClanSheets(XLSX, workbook, clans, usedNames) {
    clans.forEach((clan, index) => {
        XLSX.utils.book_append_sheet(
            workbook,
            makeSheet(XLSX, PLAYER_HEADERS, clanSheetRows(clan)),
            safeSheetName(clan.name, index, usedNames)
        );
    });
}

function appendUnassigned(XLSX, workbook, players) {
    XLSX.utils.book_append_sheet(
        workbook,
        makeSheet(XLSX, PLAYER_HEADERS, unassignedRows(players)),
        'Unassigned'
    );
}

export function createCwlExportWorkbook(snapshot, XLSX = globalThis.XLSX) {
    if (!XLSX?.utils?.book_new || !XLSX?.utils?.book_append_sheet) {
        throw new Error('XLSX library is unavailable.');
    }

    const normalized = normalizedSnapshot(snapshot);
    const workbook = XLSX.utils.book_new();
    const usedNames = new Set();
    appendOverview(XLSX, workbook, normalized.name, normalized.info.clans, usedNames);
    appendClanSheets(XLSX, workbook, normalized.info.clans, usedNames);
    appendUnassigned(XLSX, workbook, normalized.info.freePlayers);
    return workbook;
}

export function downloadCwlExportWorkbook(snapshot, options = {}) {
    const XLSX = options.XLSX || globalThis.XLSX;
    if (typeof XLSX?.writeFile !== 'function') {
        throw new Error('XLSX.writeFile is unavailable.');
    }
    const workbook = createCwlExportWorkbook(snapshot, XLSX);
    const filename = options.filename || safeExportFilename(
        snapshot?.name,
        options.extension || 'xlsx',
        options.suffix || ''
    );
    if (options.writeOptions === undefined) XLSX.writeFile(workbook, filename);
    else XLSX.writeFile(workbook, filename, options.writeOptions);
    return { workbook, filename };
}
