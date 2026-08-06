import * as config from '../Data/config.js';
import { requestJson } from '../utils/request-json.js';

const IMPORT_ROUTE = '/AchievementsImport';
const GET_ROUTE = '/Achievements';

function endpoint(path) {
    return `${config._BASE_URL}${path}`;
}

export function getAchievements(playerTag, options = {}) {
    const query = new URLSearchParams({ playerTag: String(playerTag || '') });
    return requestJson(`${endpoint(GET_ROUTE)}?${query}`, {
        method: 'GET',
        signal: options.signal,
        loading: options.loading || 'background'
    });
}

export function importAchievementBaseData(baseData, options = {}) {
    return requestJson(endpoint(IMPORT_ROUTE), {
        body: { baseData },
        signal: options.signal,
        loading: options.loading || 'blocking',
        loadingMessage: 'Analyzing your base data…',
        timeoutMs: 30_000
    });
}
