import * as config from '../Data/config.js';
import { databaseRequestWithBody } from './Supabase-Client.js?v=20260912-advanced-dashboard-v1';

function request(endpoint, body = {}) {
    return databaseRequestWithBody(config._BASE_URL + endpoint, body, null, {
        loading: 'background'
    });
}

export function getAdvancedStatsTracking(playerTag) {
    return request(config._EXT_ADVANCED_STATS_TRACKING_GET, { playerTag });
}

export function startAdvancedStatsTracking(playerTag) {
    return request(config._EXT_ADVANCED_STATS_TRACKING_START, { playerTag });
}

export function pauseAdvancedStatsTracking(playerTag) {
    return request(config._EXT_ADVANCED_STATS_TRACKING_PAUSE, { playerTag });
}

export function resumeAdvancedStatsTracking(playerTag) {
    return request(config._EXT_ADVANCED_STATS_TRACKING_RESUME, { playerTag });
}

export function stopAdvancedStatsTracking(playerTag) {
    return request(config._EXT_ADVANCED_STATS_TRACKING_STOP, { playerTag });
}

export function deleteAdvancedStatsData(playerTag) {
    return request(config._EXT_ADVANCED_STATS_DATA_DELETE, { playerTag });
}

export function attackCategoryScope(category = 'ALL') {
    const normalized = String(category || 'ALL').trim().toUpperCase();
    return normalized === 'REGULAR' ? 'regular'
        : normalized === 'COMPETITIVE' ? 'competitive' : null;
}

function periodBody(playerTag, period, category) {
    const body = { playerTag, period };
    const scope = attackCategoryScope(category);
    if (scope) body.scope = scope;
    return body;
}

export function getAdvancedStatsOverview(playerTag, period = '30d', category = 'ALL') {
    return request(config._EXT_ADVANCED_STATS_OVERVIEW, periodBody(playerTag, period, category));
}

export function getAdvancedStatsUnits(playerTag, period = '30d', category = 'ALL') {
    return request(config._EXT_ADVANCED_STATS_UNITS, { playerTag, period, category });
}

export function getAdvancedStatsArmies(playerTag, period = '30d', limit = 12) {
    return request(config._EXT_ADVANCED_STATS_ARMIES, { playerTag, period, limit });
}

export function getAdvancedStatsBattles(playerTag, period = '30d', { limit = 20, cursor = null } = {}) {
    const body = { playerTag, period, limit };
    if (cursor) body.cursor = cursor;
    return request(config._EXT_ADVANCED_STATS_BATTLES, body);
}

export function getAdvancedStatsTrends(playerTag, period = '30d', category = 'ALL') {
    return request(config._EXT_ADVANCED_STATS_TRENDS, periodBody(playerTag, period, category));
}

export function getAdvancedStatsLifetime(playerTag) {
    return request(config._EXT_ADVANCED_STATS_LIFETIME, { playerTag });
}
