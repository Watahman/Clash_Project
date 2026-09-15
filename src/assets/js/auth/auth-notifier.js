import {
    clearCachePrefix,
    clearPrivateCache,
    invalidatePrivateCache
} from '../cache/local-cache.js?v=20260829-public-auth-v1';

const LEGACY_USER_ID_KEY = 'id';

function readRememberedUserId() {
    try {
        return globalThis.localStorage?.getItem(LEGACY_USER_ID_KEY) || '';
    } catch {
        return '';
    }
}

function rememberUser(user, isCurrent) {
    if (!isCurrent()) return;
    try {
        if (user?.id) globalThis.localStorage?.setItem(LEGACY_USER_ID_KEY, user.id);
        else globalThis.localStorage?.removeItem(LEGACY_USER_ID_KEY);
    } catch {
        // The legacy identity is only a cache; storage failure must not alter auth.
    }
}

async function clearSessionCache() {
    try {
        if (typeof clearPrivateCache === 'function') {
            await clearPrivateCache();
            return;
        }
        await clearCachePrefix('');
    } catch {
        // Cache invalidation is best effort and never blocks auth state.
    }
}

export function createAuthNotifier({ getGeneration, isCurrentGeneration }) {
    let notifyQueue = Promise.resolve();

    function isCurrent(generation) {
        return isCurrentGeneration(generation);
    }

    async function applyNotification(session, generation, {
        clearAll = false,
        cacheAlreadyInvalidated = false
    } = {}) {
        if (!isCurrent(generation)) return false;
        const previousUserId = readRememberedUserId();
        const nextUserId = session?.user?.id || '';
        if (clearAll || previousUserId !== nextUserId) {
            if (!cacheAlreadyInvalidated && isCurrent(generation)) {
                try { invalidatePrivateCache?.(); } catch { /* best effort */ }
            }
            await clearSessionCache();
            if (!isCurrent(generation)) return false;
        }
        rememberUser(session?.user, () => isCurrent(generation));
        return isCurrent(generation);
    }

    function notify(session, {
        generation = getGeneration(),
        clearAll = false,
        cacheAlreadyInvalidated = false
    } = {}) {
        const notification = notifyQueue.then(() => applyNotification(session, generation, {
            clearAll,
            cacheAlreadyInvalidated
        }));
        notifyQueue = notification.catch(() => {});
        return notification;
    }

    function invalidate() {
        try { invalidatePrivateCache?.(); } catch { /* best effort */ }
    }

    return { invalidate, notify };
}
