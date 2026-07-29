import { getGroupsOfUser, getGroupClans } from '../Supabase/Supabase-Group.js';
import { getCurrentUserId } from '../utils/user.js';
import { normalizeTag } from '../operation-board/operation-board-utils.js';

export async function loadLinkedWarClans() {
    const userId = getCurrentUserId();
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
