import { getPlayerWithBattleData } from '../API/API-Functions.js';
import { addBaseToUser } from '../Supabase/Supabase-User.js';
import {
    acceptFriendRequest,
    addFriend,
    rejectFriendRequest
} from '../Supabase/Supabase-Friend.js';
import { t } from '../i18n/i18n.js';

const TAG_PATTERN = /^#[0289PYLQGRJCUV]{3,15}$/;

export function normalizePlayerTag(value) {
    let raw = String(value || '').trim();
    try {
        if (/^https?:\/\//i.test(raw)) raw = new URL(raw).searchParams.get('tag') || raw;
        raw = decodeURIComponent(raw);
    } catch { /* Validation below handles malformed values. */ }
    raw = raw.toUpperCase().replace(/O/g, '0').replace(/\s+/g, '');
    if (raw && !raw.startsWith('#')) raw = `#${raw}`;
    return raw;
}

function ensureUniqueAccount(accounts, tag) {
    const exists = accounts.some(account => normalizePlayerTag(account.tag) === tag);
    if (exists) throw new Error(t('profile.accountAlreadyExists'));
}

export async function verifyAndAddAccount({ userId, accounts, tag, token, fixture }) {
    const normalized = normalizePlayerTag(tag);
    if (!normalized || !String(token || '').trim()) throw new Error(t('profile.accountMissingFields'));
    if (!TAG_PATTERN.test(normalized)) throw new Error(t('profile.accountVerifyFailed'));
    ensureUniqueAccount(accounts, normalized);
    if (fixture) {
        return { name: 'Fixture account', tag: normalized, townHallLevel: 13 };
    }
    const playerData = await getPlayerWithBattleData(normalized);
    const account = playerData?.[0];
    if (!account) throw new Error(t('profile.accountVerifyFailed'));
    ensureUniqueAccount(accounts, normalizePlayerTag(account.tag || normalized));
    await addBaseToUser(userId, account, String(token).trim());
    return account;
}

export async function sendFriendRequest({ userId, code, ownCode, fixture }) {
    const normalized = String(code || '').trim().replace(/^#/, '').toUpperCase();
    if (!normalized) throw new Error(t('profile.friendCodeMissing'));
    if (normalized === String(ownCode || '').replace(/^#/, '').toUpperCase()) {
        throw new Error(t('profile.cannotAddSelf'));
    }
    if (fixture) return { profile: { id: `fixture-${normalized}`, name: normalized, code: normalized } };
    await addFriend(userId, normalized);
    return null;
}

export async function resolveFriendRequest({ userId, friendId, action, fixture }) {
    if (fixture) return;
    if (action === 'accept') await acceptFriendRequest(userId, friendId);
    else await rejectFriendRequest(userId, friendId);
}
