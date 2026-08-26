import { CACHE_VERSION } from './cache-policy.js?v=20260826-live-refresh';
export { normalizeTag } from './cache-keys.js';

const DATABASE_NAME = 'clashtools-cache';
const DATABASE_VERSION = 1;
const STORE_NAME = 'responses';
const LEGACY_STORAGE_PREFIX = 'clashtools.cache:';
const MIGRATION_MARKER = 'clashtools.cache.idb-migrated';
const MAX_ENTRIES = 500;
const refreshes = new Map();
const memoryFallback = new Map();
let databasePromise;

function now() {
    return Date.now();
}

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionComplete(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction afgebroken'));
    });
}

function isValidEntry(entry) {
    return Boolean(
        entry
        && entry.version === CACHE_VERSION
        && typeof entry.key === 'string'
        && Number.isFinite(entry.fetchedAt)
        && Number.isFinite(entry.staleAt)
        && Number.isFinite(entry.expiresAt)
    );
}

async function openDatabase() {
    if (!globalThis.indexedDB) return null;
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
            store.createIndex('fetchedAt', 'fetchedAt');
            store.createIndex('expiresAt', 'expiresAt');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB upgrade is geblokkeerd'));
    }).catch(() => null);

    const database = await databasePromise;
    if (database) void migrateLegacyCache(database);
    return database;
}

async function migrateLegacyCache(database) {
    try {
        if (localStorage.getItem(MIGRATION_MARKER) === '1') return;
        const entries = Object.keys(localStorage)
            .filter(key => key.startsWith(LEGACY_STORAGE_PREFIX))
            .map(key => {
                try {
                    return [key, JSON.parse(localStorage.getItem(key))];
                } catch {
                    return [key, null];
                }
            })
            .filter(([, entry]) => isValidEntry(entry));

        if (entries.length) {
            const transaction = database.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            entries.forEach(([, entry]) => store.put(entry));
            await transactionComplete(transaction);
        }
        entries.forEach(([key]) => localStorage.removeItem(key));
        localStorage.setItem(MIGRATION_MARKER, '1');
    } catch {
        // Migration is best effort; cache failure must never block application data.
    }
}

async function readEntry(key) {
    const database = await openDatabase();
    if (!database) return memoryFallback.get(key) || null;
    try {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        return await requestResult(transaction.objectStore(STORE_NAME).get(key)) || null;
    } catch {
        return memoryFallback.get(key) || null;
    }
}

async function writeEntry(entry, retry = true) {
    const database = await openDatabase();
    if (!database) {
        memoryFallback.set(entry.key, entry);
        return entry;
    }
    try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(entry);
        await transactionComplete(transaction);
        await cleanupCache(database);
        return entry;
    } catch (error) {
        if (retry && (error?.name === 'QuotaExceededError' || error?.name === 'UnknownError')) {
            await cleanupCache(database, true);
            return writeEntry(entry, false);
        }
        memoryFallback.set(entry.key, entry);
        return entry;
    }
}

export async function getCached(key, { allowExpired = false } = {}) {
    const entry = await readEntry(key);
    if (!isValidEntry(entry)) return null;
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
    return writeEntry(entry);
}

export async function removeCached(key) {
    memoryFallback.delete(key);
    const database = await openDatabase();
    if (!database) return;
    try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).delete(key);
        await transactionComplete(transaction);
    } catch {
        // Cache invalidation failure must not block the requested mutation.
    }
}

export async function clearCachePrefix(prefix) {
    for (const key of memoryFallback.keys()) {
        if (key.startsWith(prefix)) memoryFallback.delete(key);
    }
    const database = await openDatabase();
    if (!database) return;
    try {
        const transaction = database.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            if (String(cursor.key).startsWith(prefix)) cursor.delete();
            cursor.continue();
        };
        await transactionComplete(transaction);
    } catch {
        // Cache invalidation failure must not block the requested mutation.
    }
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
    const cached = await getCached(key, { allowExpired: true });
    const currentTime = now();
    const isFresh = cached && cached.expiresAt > currentTime && cached.staleAt > currentTime;
    const isStaleUsable = cached && cached.expiresAt > currentTime;
    const isFallbackUsable = cached && currentTime - cached.fetchedAt <= maxFallbackAgeMs;

    if (!forceRefresh && isFresh) return cached.data;

    const refresh = () => refreshCache(key, fetchFn, {
        ttlMs,
        staleMs,
        source,
        onRefresh,
        emitEvent,
        cached
    });
    if (!forceRefresh && isStaleUsable) {
        refresh().catch(error => onRefreshError?.(error));
        return cached.data;
    }

    try {
        return await refresh();
    } catch (error) {
        if (!forceRefresh && isFallbackUsable) return cached.data;
        throw error;
    }
}

function refreshCache(key, fetchFn, options) {
    if (refreshes.has(key)) return refreshes.get(key);
    const startedAt = now();
    const promise = Promise.resolve()
        .then(fetchFn)
        .then(async data => {
            const latest = await readEntry(key);
            if (latest?.fetchedAt > startedAt) return latest.data;
            const entry = await setCached(key, data, options.ttlMs, options.staleMs, options.source);
            if (options.onRefresh && hasChanged(options.cached?.data, data)) options.onRefresh(data, entry);
            if (options.emitEvent && hasChanged(options.cached?.data, data) && globalThis.window) {
                window.dispatchEvent(new CustomEvent('clashtools:cache-refreshed', {
                    detail: { key, data, source: options.source }
                }));
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

async function cleanupCache(database, force = false) {
    const entries = [];
    try {
        const readTransaction = database.transaction(STORE_NAME, 'readonly');
        const request = readTransaction.objectStore(STORE_NAME).openCursor();
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            entries.push(cursor.value);
            cursor.continue();
        };
        await transactionComplete(readTransaction);

        const currentTime = now();
        const keysToDelete = entries
            .filter(entry => force || !isValidEntry(entry) || entry.expiresAt <= currentTime)
            .map(entry => entry.key);
        const retained = entries
            .filter(entry => isValidEntry(entry) && entry.expiresAt > currentTime)
            .sort((a, b) => b.fetchedAt - a.fetchedAt);
        retained.slice(MAX_ENTRIES).forEach(entry => keysToDelete.push(entry.key));
        if (!keysToDelete.length) return;

        const writeTransaction = database.transaction(STORE_NAME, 'readwrite');
        const store = writeTransaction.objectStore(STORE_NAME);
        [...new Set(keysToDelete)].forEach(key => store.delete(key));
        await transactionComplete(writeTransaction);
    } catch {
        // Cleanup is best effort.
    }
}
