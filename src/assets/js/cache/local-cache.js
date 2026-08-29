import { CACHE_VERSION } from './cache-policy.js?v=20260826-live-refresh';
import {
    clearCacheEntries,
    isValidCacheEntry,
    readCacheEntry,
    removeCacheEntry,
    writeCacheEntry
} from './cache-storage.js?v=20260829-public-auth-v1';
import {
    assertPrivateCacheEpoch,
    getPrivateCacheEpoch,
    getPrivateCacheRefreshKey,
    isPrivateCacheEpochChanged,
    isPrivateCacheSource,
    isPrivateEntryInvalid
} from './private-cache-context.js?v=20260829-public-auth-v1';
export { normalizeTag } from './cache-keys.js';
export { invalidatePrivateCache } from './private-cache-context.js?v=20260829-public-auth-v1';

const refreshes = new Map();

function now() {
    return Date.now();
}

export async function getCached(key, { allowExpired = false } = {}) {
    const entry = await readCacheEntry(key);
    if (!isValidCacheEntry(entry)) return null;
    if (isPrivateEntryInvalid(entry)) return null;
    if (!allowExpired && entry.expiresAt <= now()) {
        await removeCached(key);
        return null;
    }
    return entry;
}

export async function setCached(key, data, ttlMs, staleMs = ttlMs, source = 'backend') {
    if (!key || ttlMs <= 0) return null;
    const fetchedAt = now();
    const entry = {
        key,
        data,
        fetchedAt,
        staleAt: fetchedAt + Math.max(0, staleMs),
        expiresAt: fetchedAt + ttlMs,
        source,
        version: CACHE_VERSION
    };
    if (isPrivateCacheSource(source)) entry.privateCacheEpoch = getPrivateCacheEpoch(source);
    return writeCacheEntry(entry);
}

export async function clearPrivateCache() {
    await clearCacheEntries(entry => isPrivateCacheSource(entry?.source));
}

export async function removeCached(key) {
    await removeCacheEntry(key);
}

export async function clearCachePrefix(prefix) {
    await clearCacheEntries((entry, key) => String(key).startsWith(prefix));
}

export function invalidateUserCache(userId) {
    if (!userId) return Promise.resolve();
    const encoded = encodeURIComponent(userId);
    return Promise.all([
        `users.info:${encoded}`,
        `users.check:${encoded}`,
        `users.accounts:${encoded}`,
        `friends.list:${encoded}`,
        `friends.pending:${encoded}`,
        `friends.requests:${encoded}`,
        `groups.ofUser:${encoded}`,
        `plans.ofUser:${encoded}`
    ].map(clearCachePrefix));
}

export async function getCachedThenRefresh(key, fetchFn, options = {}) {
    const {
        ttlMs,
        staleMs = ttlMs,
        source = 'backend',
        forceRefresh = false,
        maxFallbackAgeMs = Math.min(
            30 * 24 * 60 * 60 * 1000,
            Math.max(5 * 60 * 1000, Number(ttlMs || 0) * 4)
        ),
        onRefresh,
        onRefreshError,
        emitEvent = true
    } = options;
    const requestPrivateEpoch = getPrivateCacheEpoch(source);
    const cached = await getCached(key, { allowExpired: true });
    assertPrivateCacheEpoch(source, requestPrivateEpoch);
    const currentTime = now();
    const isFresh = cached && cached.expiresAt > currentTime && cached.staleAt > currentTime;
    const isStaleUsable = cached && cached.expiresAt > currentTime;
    const isFallbackUsable = cached && currentTime - cached.fetchedAt <= maxFallbackAgeMs;

    if (!forceRefresh && isFresh) {
        assertPrivateCacheEpoch(source, requestPrivateEpoch);
        return cached.data;
    }

    const refresh = () => refreshCache(key, fetchFn, {
        ttlMs,
        staleMs,
        source,
        onRefresh,
        emitEvent,
        cached,
        privateCacheEpoch: requestPrivateEpoch
    });
    if (!forceRefresh && isStaleUsable && requiresAuthFreshness(source)) {
        try {
            return await refresh();
        } catch (error) {
            if (isPrivateCacheEpochChanged(source, requestPrivateEpoch)) throw error;
            if (isSessionExpiredError(error, source)) throw error;
            await onRefreshError?.(error);
            assertPrivateCacheEpoch(source, requestPrivateEpoch);
            return cached.data;
        }
    }
    if (!forceRefresh && isStaleUsable) {
        refresh().catch(error => onRefreshError?.(error));
        return cached.data;
    }

    try {
        return await refresh();
    } catch (error) {
        if (isPrivateCacheEpochChanged(source, requestPrivateEpoch)) throw error;
        if (isSessionExpiredError(error, source)) {
            await removeCached(key);
            throw error;
        }
        if (!forceRefresh && isFallbackUsable) {
            assertPrivateCacheEpoch(source, requestPrivateEpoch);
            return cached.data;
        }
        throw error;
    }
}

function refreshCache(key, fetchFn, options) {
    const refreshKey = getRefreshKey(key, options);
    if (refreshes.has(refreshKey)) return refreshes.get(refreshKey);
    const startedAt = now();
    const promise = Promise.resolve()
        .then(fetchFn)
        .then(async data => {
            assertPrivateCacheEpoch(options.source, options.privateCacheEpoch);
            const latest = await readCacheEntry(key);
            assertPrivateCacheEpoch(options.source, options.privateCacheEpoch);
            if (latest?.fetchedAt > startedAt) return latest.data;
            const entry = await setCached(key, data, options.ttlMs, options.staleMs, options.source);
            assertPrivateCacheEpoch(options.source, options.privateCacheEpoch);
            if (options.onRefresh && hasChanged(options.cached?.data, data)) {
                await options.onRefresh(data, entry);
                assertPrivateCacheEpoch(options.source, options.privateCacheEpoch);
            }
            if (options.emitEvent && hasChanged(options.cached?.data, data) && globalThis.window) {
                window.dispatchEvent(new CustomEvent('clashtools:cache-refreshed', {
                    detail: { key, data, source: options.source }
                }));
            }
            assertPrivateCacheEpoch(options.source, options.privateCacheEpoch);
            return data;
        })
        .catch(async error => {
            if (isSessionExpiredError(error, options.source)
                && !isPrivateCacheEpochChanged(options.source, options.privateCacheEpoch)) {
                await removeCached(key);
            }
            throw error;
        })
        .finally(() => refreshes.delete(refreshKey));
    refreshes.set(refreshKey, promise);
    return promise;
}

function hasChanged(previous, next) {
    if (previous === undefined) return true;
    try {
        return JSON.stringify(previous) !== JSON.stringify(next);
    } catch {
        return previous !== next;
    }
}

function isSessionExpiredError(error, source) {
    if (!isPrivateCacheSource(source)) return false;
    return Number(error?.status) === 401
        || error?.sessionExpired === true
        || error?.code === 'SESSION_EXPIRED'
        || error?.code === 'AUTH_SESSION_EXPIRED';
}

function getRefreshKey(key, options) {
    return isPrivateCacheSource(options.source)
        ? getPrivateCacheRefreshKey(key, options.privateCacheEpoch)
        : key;
}

function requiresAuthFreshness(source) {
    return isPrivateCacheSource(source);
}
