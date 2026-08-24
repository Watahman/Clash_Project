export const BRACKET_STORAGE_KEY = 'clashtools.bracket.current';

function storageEnabled(enabled) {
    try {
        return enabled() !== false;
    } catch {
        return false;
    }
}

export function createBracketStorage({
    storage = globalThis.localStorage,
    key = BRACKET_STORAGE_KEY,
    enabled = () => true
} = {}) {
    function remove() {
        if (!storageEnabled(enabled) || typeof storage?.removeItem !== 'function') return false;
        try {
            storage?.removeItem(key);
            return true;
        } catch {
            return false;
        }
    }

    function save(bracket) {
        if (!bracket || !storageEnabled(enabled) || typeof storage?.setItem !== 'function') return false;
        try {
            storage?.setItem(key, JSON.stringify(bracket));
            return true;
        } catch {
            return false;
        }
    }

    function restore(importer) {
        if (!storageEnabled(enabled) || typeof storage?.getItem !== 'function') return null;
        try {
            const stored = storage?.getItem(key);
            if (!stored) return null;
            return importer(stored);
        } catch (error) {
            remove();
            throw error;
        }
    }

    return Object.freeze({ save, restore, remove });
}
