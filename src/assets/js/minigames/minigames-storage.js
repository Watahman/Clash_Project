function storageOrDefault(storage) {
    return storage || globalThis.localStorage;
}

export function readJson(key, fallback = null, storage = globalThis.localStorage) {
    try {
        const value = storageOrDefault(storage)?.getItem(key);
        return value === null || value === undefined ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

export function readString(key, fallback = '', storage = globalThis.localStorage) {
    try {
        return storageOrDefault(storage)?.getItem(key) || fallback;
    } catch {
        return fallback;
    }
}

export function writeJson(key, value, storage = globalThis.localStorage) {
    try {
        storageOrDefault(storage)?.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function writeString(key, value, storage = globalThis.localStorage) {
    try {
        storageOrDefault(storage)?.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function removeStoredValue(key, storage = globalThis.localStorage) {
    try {
        storageOrDefault(storage)?.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

export function shouldPersistDailyState(mode, fixtureActive = false) {
    return mode === 'daily' && !fixtureActive;
}
