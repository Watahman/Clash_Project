import * as config from '../Data/config.js';
import { fetchClashAPIRequest } from './API-Client.js';
import { cacheKeys } from '../cache/cache-keys.js';
import { CACHE_STALE, CACHE_TTL } from '../cache/cache-policy.js';

function request(path, resource, requestOptions = {}) {
    return fetchClashAPIRequest(
        config._BASE_URL + path,
        '{}',
        {
            key: cacheKeys.clashResource(resource),
            ttlMs: CACHE_TTL.CLASH_REFERENCE,
            staleMs: CACHE_STALE.LONG
        },
        requestOptions
    );
}

export const getPlayerLabelsRequest = options =>
    request(config._EXT_LABELS_PLAYERS, 'labels-players', options);
export const getClanLabelsRequest = options =>
    request(config._EXT_LABELS_CLANS, 'labels-clans', options);
