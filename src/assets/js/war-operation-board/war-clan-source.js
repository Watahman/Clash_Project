import { getGroupsOfUser, getGroupClans } from '../Supabase/Supabase-Group.js?v=20260829-public-auth-v1';
import { normalizeTag } from '../operation-board/operation-board-utils.js';

export function getWarSourceUserId(authState = {}) {
    if (authState?.status !== 'authenticated') return '';
    return String(authState.session?.user?.id || '').trim();
}

export function createWarSourceGuard() {
    let token = 0;
    let currentUserId = '';

    function transition(authState) {
        const nextUserId = getWarSourceUserId(authState);
        const changed = nextUserId !== currentUserId;
        if (changed) token += 1;
        currentUserId = nextUserId;
        return { changed, token, userId: nextUserId };
    }

    function begin(authState) {
        token += 1;
        return { token, userId: getWarSourceUserId(authState) };
    }

    function isCurrent(request, authState) {
        if (!request) return false;
        return request.token === token
            && request.userId === currentUserId
            && request.userId === getWarSourceUserId(authState);
    }

    return { begin, isCurrent, transition };
}

export async function loadLinkedWarClans({ authState } = {}) {
    const userId = getWarSourceUserId(authState);
    if (!userId) return [];
    const groups = await getGroupsOfUser(userId);
    const clanLists = await Promise.allSettled(
        (Array.isArray(groups) ? groups : []).map(group =>
            getGroupClans(group.id || group.groupId || group.group_id)
        )
    );
    const clans = new Map();
    clanLists.forEach(result => {
        if (result.status !== 'fulfilled') return;
        (Array.isArray(result.value) ? result.value : []).forEach(clan => {
            const tag = normalizeTag(clan.tag || clan.clanTag || clan.clan_tag);
            if (!tag) return;
            clans.set(tag, {
                tag,
                name: clan.name || clan.clanName || clan.clan_name || tag
            });
        });
    });
    return Array.from(clans.values()).sort((a, b) => a.name.localeCompare(b.name));
}
