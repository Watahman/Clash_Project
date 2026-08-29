import { getGroupClans, getGroupInfo, getGroupMembers, getGroupsOfUser } from "../Supabase/Supabase-Group.js?v=20260829-public-auth-v1";
import { getGroupPolls } from "../Supabase/Supabase-GroupPolls.js?v=20260829-public-auth-v1";
import { getUserBases } from "../Supabase/Supabase-User.js?v=20260829-public-auth-v1";
import { getCurrentUserId } from "../utils/user.js";
import { createPrivateSourceAuth } from "./cwl-private-source-auth.js?v=20260829-public-auth-v1";
import { normalizePolls } from "./cwl-group-source-utils.js?v=20260829-public-auth-v1";
import { uniquePlayers } from "./cwl-utils.js";

/**
 * Owns the authenticated group source and its asynchronous lifecycle.
 * Consumers receive callbacks only after the request still belongs to the
 * active session, so a late response cannot repopulate another account's UI.
 */
export function createGroupSourceController({
    getFallbackUserId = getCurrentUserId,
    onAuthStateChange,
    onGroupsLoaded,
    onGroupsLoadError,
    onGroupLoaded,
    onGroupLoadError
} = {}) {
    const privateAuth = createPrivateSourceAuth({ getFallbackUserId });
    const groupState = new Map();
    const pollCatalog = new Map();
    let pollCatalogGroups = [];

    function clearSourceState() {
        groupState.clear();
        pollCatalog.clear();
        pollCatalogGroups = [];
    }

    function handleAuthStateChange(state) {
        clearSourceState();
        onAuthStateChange?.(state);
        if (privateAuth.canRead() && privateAuth.getUserId()) void loadGroups();
    }

    async function loadGroups() {
        const token = privateAuth.startRequest();
        const userId = privateAuth.getUserId();
        if (!privateAuth.canRead() || !userId) return;
        try {
            const memberships = await getGroupsOfUser(userId);
            if (!privateAuth.isCurrent(token, userId)) return;
            if (!Array.isArray(memberships)) {
                onGroupsLoaded?.([]);
                return;
            }
            const groups = await loadGroupInfo(memberships, token, userId);
            if (!privateAuth.isCurrent(token, userId)) return;
            await loadPollCatalog(groups, token, userId);
            if (privateAuth.isCurrent(token, userId)) onGroupsLoaded?.(groups);
        } catch (error) {
            if (!privateAuth.isCurrent(token, userId)) return;
            console.error(error);
            onGroupsLoadError?.(error);
        }
    }

    async function loadGroupInfo(memberships, token, userId) {
        return (await Promise.all(memberships.map(async membership => {
            if (!privateAuth.isCurrent(token, userId)) return null;
            const info = await getGroupInfo(membership.group_id).catch(() => null);
            return Array.isArray(info) ? info[0] : info;
        }))).filter(group => group?.id);
    }

    async function loadPollCatalog(groups, token, userId) {
        pollCatalog.clear();
        pollCatalogGroups = [];
        if (!groups.length) return;

        const results = await Promise.all(groups.map(async group => {
            if (!privateAuth.isCurrent(token, userId)) return { group, polls: [], failed: true };
            try {
                const polls = normalizePolls(await getGroupPolls(group.id, userId));
                return { group, polls, failed: false };
            } catch (error) {
                console.error(error);
                return { group, polls: [], failed: true };
            }
        }));

        if (!privateAuth.isCurrent(token, userId)) return;
        pollCatalogGroups = results;
        results.forEach(({ group, polls }) => {
            const existing = groupState.get(group.id) || {};
            groupState.set(group.id, { ...existing, polls });
            polls.forEach(poll => pollCatalog.set(pollSelectionValue(group.id, poll.id), { group, poll }));
        });
    }

    async function loadSelectedGroup(groupId, preferredPollId = "") {
        const token = privateAuth.startRequest();
        const userId = privateAuth.getUserId();
        if (!groupId || !privateAuth.isCurrent(token, userId)) return;

        try {
            const [members, clans, polls] = await Promise.all([
                getGroupMembers(groupId).catch(logAndEmpty),
                getGroupClans(groupId).catch(logAndEmpty),
                getGroupPolls(groupId, userId).catch(logAndEmpty)
            ]);
            const players = await loadGroupPlayers(members, token, userId);
            if (!privateAuth.isCurrent(token, userId)) return;
            groupState.set(groupId, {
                members,
                clans: Array.isArray(clans) ? clans : [],
                polls: normalizePolls(polls),
                players
            });
            onGroupLoaded?.(groupId, preferredPollId);
        } catch (error) {
            if (!privateAuth.isCurrent(token, userId)) return;
            console.error(error);
            onGroupLoadError?.(error);
        }
    }

    async function loadGroupPlayers(members, token, userId) {
        const users = await Promise.all((Array.isArray(members) ? members : []).map(member => {
            if (!privateAuth.isCurrent(token, userId)) return null;
            return getUserBases(member.user_id).catch(() => null);
        }));
        const accounts = users.flatMap(userData => parseAccounts(
            (Array.isArray(userData) ? userData[0] : userData)?.accounts
        ));
        return uniquePlayers(accounts);
    }

    function logAndEmpty(error) {
        console.error(error);
        return [];
    }

    function init(authState) {
        clearSourceState();
        privateAuth.configure(authState);
        privateAuth.bind(handleAuthStateChange);
    }

    return {
        canRead: privateAuth.canRead,
        getGroupState: groupId => groupState.get(groupId),
        getPollCatalog: () => pollCatalog,
        getPollCatalogGroups: () => pollCatalogGroups,
        getUserId: privateAuth.getUserId,
        init,
        loadGroups,
        loadSelectedGroup
    };
}

function parseAccounts(accounts) {
    if (Array.isArray(accounts)) return accounts;
    if (typeof accounts !== "string" || !accounts.trim()) return [];
    try {
        const parsed = JSON.parse(accounts);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function pollSelectionValue(groupId, pollId) {
    return groupId && pollId ? `${groupId}::${pollId}` : "";
}
