import { CACHE_VERSION } from './cache-policy.js';
export { normalizeTag } from './cache-keys.js';

const STORAGE_PREFIX = 'clashtools.cache:';
const MAX_ENTRIES = 250;
const refreshes = new Map();

function storageKey(key) {
    return `${STORAGE_PREFIX}${key}`;
}

function now() {
    return Date.now();
}

function safeParse(raw) {
    if (!raw) return null;
    try {
        const entry = JSON.parse(raw);
        if (entry?.version !== CACHE_VERSION) return null;
        return entry;
    } catch {
        return null;
    }
}

function readEntry(key) {
    try {
        return safeParse(localStorage.getItem(storageKey(key)));
    } catch {
        return null;
    }
}

function writeEntry(entry) {
    try {
        localStorage.setItem(storageKey(entry.key), JSON.stringify(entry));
        cleanupCache();
    } catch {
        cleanupCache(true);
    }
}

export function getCached(key, { allowExpired = false } = {}) {
    const entry = readEntry(key);
    if (!entry) return null;
    if (!allowExpired && entry.expiresAt <= now()) {
        removeCached(key);
        return null;
    }
    return entry;
}

export function setCached(key, data, ttlMs, staleMs = ttlMs, source = 'backend') {
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
    writeEntry(entry);
    return entry;
}

export function removeCached(key) {
    try {
        localStorage.removeItem(storageKey(key));
    } catch {
        // Cache failures should never block the app.
    }
}

export function clearCachePrefix(prefix) {
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith(STORAGE_PREFIX + prefix))
            .forEach(key => localStorage.removeItem(key));
    } catch {
        // Cache failures should never block the app.
    }
}

export function invalidateUserCache(userId) {
    if (!userId) return;
    clearCachePrefix(`users.info:${encodeURIComponent(userId)}`);
    clearCachePrefix(`users.check:${encodeURIComponent(userId)}`);
    clearCachePrefix(`users.accounts:${encodeURIComponent(userId)}`);
    clearCachePrefix(`friends.list:${encodeURIComponent(userId)}`);
    clearCachePrefix(`friends.pending:${encodeURIComponent(userId)}`);
    clearCachePrefix(`friends.requests:${encodeURIComponent(userId)}`);
    clearCachePrefix(`groups.ofUser:${encodeURIComponent(userId)}`);
    clearCachePrefix(`plans.ofUser:${encodeURIComponent(userId)}`);
}

export async function getCachedThenRefresh(key, fetchFn, options = {}) {
    const {
        ttlMs,
        staleMs = ttlMs,
        source = 'backend',
        forceRefresh = false,
        onRefresh,
        emitEvent = true
    } = options;
    const cached = getCached(key, { allowExpired: true });
    const isFresh = cached && cached.expiresAt > now() && cached.staleAt > now();
    const isStaleUsable = cached && cached.expiresAt > now();

    if (!forceRefresh && isFresh) return cached.data;

    const refresh = () => refreshCache(key, fetchFn, { ttlMs, staleMs, source, onRefresh, emitEvent, cached });
    if (!forceRefresh && isStaleUsable) {
        refresh();
        return cached.data;
    }

    try {
        return await refresh();
    } catch (error) {
        if (cached) return cached.data;
        throw error;
    }
}

function refreshCache(key, fetchFn, options) {
    if (refreshes.has(key)) return refreshes.get(key);
    const startedAt = now();
    const promise = Promise.resolve()
        .then(fetchFn)
        .then(data => {
            const latest = readEntry(key);
            if (latest?.fetchedAt > startedAt) return latest.data;
            const entry = setCached(key, data, options.ttlMs, options.staleMs, options.source);
            if (options.onRefresh && hasChanged(options.cached?.data, data)) options.onRefresh(data, entry);
            if (options.emitEvent && hasChanged(options.cached?.data, data)) {
                window.dispatchEvent(new CustomEvent('clashtools:cache-refreshed', { detail: { key, data, source: options.source } }));
            }
            return data;
        })
        .finally(() => refreshes.delete(key));
    refreshes.set(key, promise);
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

function cleanupCache(force = false) {
    try {
        const entries = Object.keys(localStorage)
            .filter(key => key.startsWith(STORAGE_PREFIX))
            .map(key => [key, safeParse(localStorage.getItem(key))])
            .filter(([, entry]) => entry);
        const current = now();
        entries
            .filter(([, entry]) => force || entry.expiresAt <= current)
            .forEach(([key]) => localStorage.removeItem(key));
        const remaining = entries
            .filter(([, entry]) => entry.expiresAt > current)
            .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
        while (remaining.length > MAX_ENTRIES) {
            const [key] = remaining.shift();
            localStorage.removeItem(key);
        }
    } catch {
        // Cache failures should never block the app.
    }
}
