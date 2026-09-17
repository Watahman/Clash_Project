const KNOWN_STATES = new Set(['idle', 'loading', 'empty', 'partial', 'unavailable', 'error', 'ready']);

export function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
}

export function payloadFor(data) {
    if (Array.isArray(data)) return data;
    if (data?.data && typeof data.data === 'object' && !Array.isArray(data.rows)) return data.data;
    return data || null;
}

export function genericRows(payload) {
    if (Array.isArray(payload)) return payload;
    for (const key of ['rows', 'seasons', 'events', 'changes', 'items', 'records']) {
        if (Array.isArray(payload?.[key])) return payload[key];
    }
    return [];
}

export function readField(row, keys) {
    for (const key of keys) {
        if (hasValue(row?.[key])) return row[key];
        if (hasValue(row?.metrics?.[key])) return row.metrics[key];
        if (hasValue(row?.summary?.[key])) return row.summary[key];
    }
    return null;
}

function normalizedStatus(value) {
    const status = String(value || '').toLowerCase().replaceAll('-', '_');
    if (['no_data', 'nohistory', 'no_history'].includes(status)) return 'empty';
    if (['complete', 'available'].includes(status)) return 'ready';
    if (status === 'unsupported') return 'unavailable';
    return KNOWN_STATES.has(status) ? status : '';
}

function degradedCoverage(coverage) {
    if (['partial', 'degraded'].includes(String(coverage?.state ?? coverage?.status ?? '').toLowerCase())) return true;
    return (Array.isArray(coverage?.sources) ? coverage.sources : []).some(source => {
        const status = typeof source === 'object' ? source?.status ?? source?.state : source;
        return ['partial', 'degraded'].includes(String(status || '').toLowerCase());
    });
}

export function stateFor(data, payload, rows) {
    if (data === null || data === undefined) return 'unavailable';
    const payloadStatus = normalizedStatus(payload?.state ?? payload?.status);
    const coverageStatus = normalizedStatus(payload?.coverage?.state ?? payload?.coverage?.status);
    if (payload?.coverage?.hasHistoricalData === false) {
        if (payloadStatus === 'error' || coverageStatus === 'error') return 'error';
        if (payloadStatus === 'unavailable' || coverageStatus === 'unavailable') return 'unavailable';
        return degradedCoverage(payload.coverage) ? 'partial' : 'empty';
    }
    const wrapperStatus = payload !== data && data?.data && typeof data.data === 'object'
        ? normalizedStatus(data?.state ?? data?.status) : '';
    const explicit = payloadStatus || coverageStatus || wrapperStatus;
    if (explicit) return explicit;
    if (data?.error || payload?.error) return 'error';
    if (Array.isArray(rows) && rows.length) return 'ready';
    if (Array.isArray(rows)) return 'empty';
    return 'unavailable';
}

function matchupLabel(value) {
    if (!hasValue(value)) return null;
    if (typeof value !== 'object') return value;
    const label = value.label ?? value.name;
    if (hasValue(label)) return label;
    const from = value.attackerTownHall ?? value.attackerTh ?? value.from;
    const to = value.defenderTownHall ?? value.defenderTh ?? value.to;
    if (hasValue(from) && hasValue(to)) return `${from} → ${to}`;
    return value.townHall ?? value.level ?? value.value ?? null;
}

function matchupValue(block) {
    const matchups = block?.matchups;
    if (Array.isArray(matchups)) return matchups.map(matchupLabel).filter(hasValue).join(', ') || null;
    if (!matchups || typeof matchups !== 'object') return matchupLabel(matchups);
    const breakdown = {};
    ['same', 'up', 'down'].forEach(key => {
        if (hasValue(matchups[key])) breakdown[key] = matchups[key];
    });
    if (Object.keys(breakdown).length) return breakdown;
    return matchupLabel(matchups);
}

function warRow(block, mode, period = null) {
    return {
        period: period ?? readField(block, ['period', 'season']),
        mode,
        attacks: readField(block, ['attackCount', 'attacks', 'playerAttacks']),
        availableAttacks: readField(block, ['availableAttacks']),
        usedAttacks: readField(block, ['usedAttacks']),
        missedAttacks: readField(block, ['missedAttacks']),
        stars: readField(block, ['stars', 'totalStars']),
        avgStars: readField(block, ['avgStars', 'averageStars']),
        destruction: readField(block, ['destruction', 'totalDestruction']),
        avgDestruction: readField(block, ['avgDestruction', 'averageDestruction']),
        tripleRate: readField(block, ['tripleRate', 'threeStarRate']),
        thMatchup: matchupValue(block),
        sample: readField(block, ['warCount', 'seasonCount', 'sample', 'sampleSize'])
    };
}

function warRows(payload) {
    const modes = payload?.modes && typeof payload.modes === 'object' ? payload.modes : payload;
    const rows = [];
    for (const mode of ['regular', 'cwl']) {
        const block = modes?.[mode];
        if (!block || typeof block !== 'object') continue;
        if (['unavailable', 'empty', 'error'].includes(normalizedStatus(block.status))) continue;
        rows.push(warRow(block, mode));
        if (mode !== 'cwl' || !Array.isArray(block.seasons)) continue;
        block.seasons.forEach(season => {
            if (season && typeof season === 'object') rows.push(warRow({ ...block, ...season }, mode, readField(season, ['season', 'period'])));
        });
    }
    return rows;
}

function leagueRow(block, mode, period = null) {
    return {
        season: period ?? readField(block, ['season', 'period']),
        mode,
        league: readField(block, ['league', 'leagueName']),
        rank: readField(block, ['rank', 'position']),
        attacks: readField(block, ['attacks', 'attackCount', 'playerAttacks']),
        stars: readField(block, ['stars', 'totalStars']),
        destruction: readField(block, ['destruction', 'totalDestruction']),
        avgStars: readField(block, ['avgStars', 'averageStars']),
        avgDestruction: readField(block, ['avgDestruction', 'averageDestruction']),
        sample: readField(block, ['seasonCount', 'sample', 'sampleSize'])
    };
}

function leagueRows(payload) {
    const modes = payload?.modes && typeof payload.modes === 'object' ? payload.modes : payload;
    const rows = [];
    for (const mode of ['ranked', 'legend']) {
        const block = modes?.[mode];
        if (!block || typeof block !== 'object') continue;
        if (['unavailable', 'empty', 'error'].includes(normalizedStatus(block.status))) continue;
        if (block.summary && typeof block.summary === 'object') rows.push(leagueRow(block.summary, mode));
        (Array.isArray(block.seasons) ? block.seasons : []).forEach(season => {
            if (season && typeof season === 'object') rows.push(leagueRow({ ...block, ...season }, mode, readField(season, ['season', 'period'])));
        });
    }
    return rows;
}

export function rowsForSection(section, payload) {
    if (section === 'warCwl') {
        const rows = warRows(payload);
        return payload?.modes && typeof payload.modes === 'object'
            ? rows
            : rows.length ? rows : genericRows(payload);
    }
    if (section === 'league') {
        const rows = leagueRows(payload);
        return payload?.modes && typeof payload.modes === 'object'
            ? rows
            : rows.length ? rows : genericRows(payload);
    }
    return genericRows(payload);
}
