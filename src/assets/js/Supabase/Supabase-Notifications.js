import * as config from '../Data/config.js';
import { databaseRequestWithBody } from './Supabase-Client.js';
import { cacheKeys } from '../cache/cache-keys.js';
import { CACHE_STALE, CACHE_TTL } from '../cache/cache-policy.js';
import { removeCached } from '../cache/local-cache.js';

export function getNotifications(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_NOTIFICATIONS_GET;
    return databaseRequestWithBody(path, {}, {
        key: cacheKeys.notifications(userId),
        ttlMs: CACHE_TTL.NOTIFICATIONS,
        staleMs: CACHE_STALE.SHORT
    });
}

export function markNotificationRead(userId, notificationId) {
    const path = config._BASE_URL + config._EXT_SUPA_NOTIFICATION_READ;
    return databaseRequestWithBody(path, { notificationId }).then(result => {
        removeCached(cacheKeys.notifications(userId));
        return result;
    });
}
