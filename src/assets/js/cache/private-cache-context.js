const PRIVATE_CACHE_EPOCH_KEY = 'clashtools.private-cache-epoch';
const PRIVATE_CACHE_STATE_KEY = '__CLASHTOOLS_PRIVATE_CACHE_STATE__';
const PRIVATE_CACHE_LISTENER_KEY = '__CLASHTOOLS_PRIVATE_CACHE_LISTENER__';
const PRIVATE_CACHE_SOURCE = 'supabase';

const privateCacheState = getPrivateCacheState();
installStorageListener();

function createPrivateCacheEpoch() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readPersistedEpoch() {
    try {
        return globalThis.localStorage?.getItem(PRIVATE_CACHE_EPOCH_KEY) || '';
    } catch {
        return '';
    }
}

function persistEpoch(epoch) {
    try {
        globalThis.localStorage?.setItem(PRIVATE_CACHE_EPOCH_KEY, epoch);
    } catch {
        // Cache invalidation remains best effort when storage is unavailable.
    }
}

function getPrivateCacheState() {
    const shared = globalThis[PRIVATE_CACHE_STATE_KEY];
    if (shared?.epoch) return shared;

    const state = { epoch: readPersistedEpoch() || createPrivateCacheEpoch() };
    globalThis[PRIVATE_CACHE_STATE_KEY] = state;
    persistEpoch(state.epoch);
    return state;
}

function installStorageListener() {
    if (typeof window === 'undefined' || globalThis[PRIVATE_CACHE_LISTENER_KEY]) return;

    const listener = event => {
        if (event?.key !== PRIVATE_CACHE_EPOCH_KEY || !event.newValue) return;
        privateCacheState.epoch = event.newValue;
    };
    globalThis[PRIVATE_CACHE_LISTENER_KEY] = listener;
    window.addEventListener('storage', listener);
}

export function isPrivateCacheSource(source) {
    return source === PRIVATE_CACHE_SOURCE;
}

export function getPrivateCacheEpoch(source) {
    if (!isPrivateCacheSource(source)) return null;
    synchronizePrivateCacheEpoch();
    return privateCacheState.epoch;
}

export function synchronizePrivateCacheEpoch() {
    const persistedEpoch = readPersistedEpoch();
    if (persistedEpoch && persistedEpoch !== privateCacheState.epoch) {
        privateCacheState.epoch = persistedEpoch;
    }
    return privateCacheState.epoch;
}

export function invalidatePrivateCache() {
    privateCacheState.epoch = createPrivateCacheEpoch();
    persistEpoch(privateCacheState.epoch);
    return privateCacheState.epoch;
}

export function isPrivateCacheEpochChanged(source, epoch) {
    return isPrivateCacheSource(source) && getPrivateCacheEpoch(source) !== epoch;
}

export function assertPrivateCacheEpoch(source, epoch) {
    if (isPrivateCacheEpochChanged(source, epoch)) throw new PrivateCacheInvalidatedError();
}

export function isPrivateEntryInvalid(entry) {
    return isPrivateCacheSource(entry?.source)
        && entry.privateCacheEpoch !== getPrivateCacheEpoch(entry.source);
}

export function getPrivateCacheRefreshKey(key, epoch) {
    return `${key}\u0000${epoch}`;
}

export class PrivateCacheInvalidatedError extends Error {
    constructor() {
        super('Private cache belongs to an earlier authentication session');
        this.name = 'PrivateCacheInvalidatedError';
        this.code = 'PRIVATE_CACHE_INVALIDATED';
        this.sessionBound = true;
    }
}
