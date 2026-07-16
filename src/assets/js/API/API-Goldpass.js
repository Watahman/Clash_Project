import * as config from '../Data/config.js';
import { fetchClashAPIRequest } from './API-Client.js';
import { cacheKeys } from '../cache/cache-keys.js';
import { CACHE_STALE, CACHE_TTL } from '../cache/cache-policy.js';

export function getCurrentGoldPassRequest(requestOptions = {}) {
    return fetchClashAPIRequest(
        config._BASE_URL + config._EXT_GOLDPASS,
        '{}',
        {
            key: cacheKeys.clashResource('gold-pass-current'),
            ttlMs: CACHE_TTL.CLASH_GOLD_PASS,
            staleMs: CACHE_STALE.LONG
        },
        requestOptions
    );
}
