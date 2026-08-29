import * as config from '../Data/config.js';
import { requestJson } from '../utils/request-json.js?v=20260829-public-auth-v1';

const IMPORT_ROUTE = '/AchievementsImport';
const GET_ROUTE = '/Achievements';

function endpoint(path) {
    return `${config._BASE_URL}${path}`;
}

export function getAchievements(playerTag, options = {}) {
    const query = new URLSearchParams({ playerTag: String(playerTag || '') });
    if (options.deepHistory) query.set('deepHistory', '1');
    return requestJson(`${endpoint(GET_ROUTE)}?${query}`, {
        method: 'GET',
        signal: options.signal,
        loading: options.loading || 'background',
        timeoutMs: options.deepHistory ? 45_000 : undefined,
        sessionBound: true
    });
}

export function importAchievementBaseData(baseData, options = {}) {
    return requestJson(endpoint(IMPORT_ROUTE), {
        body: { baseData },
        signal: options.signal,
        loading: options.loading || 'blocking',
        loadingMessage: 'Analyzing your base data…',
        timeoutMs: 30_000,
        sessionBound: true
    });
}
