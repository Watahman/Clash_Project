export function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    return tag ? (tag.startsWith('#') ? tag : `#${tag}`) : '';
}

function collectAccount(value, output) {
    if (!value) return;
    if (typeof value === 'string') {
        const tag = normalizeTag(value);
        if (tag) output.push({ tag, name: tag });
        return;
    }
    if (Array.isArray(value)) {
        value.forEach(item => collectAccount(item, output));
        return;
    }
    if (typeof value !== 'object') return;
    const tag = normalizeTag(value.tag || value.playerTag || value.accountTag || value.clashTag);
    if (tag) {
        const name = String(value.name || value.playerName || value.accountName || value.baseName || tag).trim() || tag;
        output.push({ tag, name, townHallLevel: value.townHallLevel || value.townhall || value.townHall || value.th });
    }
    collectAccount(value.base, output);
    collectAccount(value.account, output);
}

export function accountsFromProfile(result) {
    const profile = Array.isArray(result) ? result[0] : result;
    const collected = [];
    collectAccount(profile?.accounts, collected);
    collectAccount(profile?.bases, collected);
    return [...new Map(collected.map(account => [account.tag, account])).values()];
}

export function selectInitialAccount(accounts, storedTag = '') {
    const queryTag = new URLSearchParams(window.location.search).get('playerTag');
    const preferred = [queryTag, storedTag].map(normalizeTag).filter(Boolean);
    return preferred.find(tag => accounts.some(account => account.tag === tag)) || accounts[0]?.tag || '';
}
