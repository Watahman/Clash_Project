export const ROLE_MEMBER = 'member';
export const ROLE_CO_LEADER = 'co_leader';
export const ROLE_LEADER = 'leader';

const ROLE_CLASSES = ['leader', 'co-leader'];

export function normalizeGroupRole(role) {
    if (role === ROLE_LEADER || role === ROLE_CO_LEADER) return role;
    if (role === 'co-leader') return ROLE_CO_LEADER;
    return ROLE_MEMBER;
}

export function isGroupAdmin(role) {
    const safeRole = normalizeGroupRole(role);
    return safeRole === ROLE_LEADER || safeRole === ROLE_CO_LEADER;
}

export function isGroupLeader(role) {
    return normalizeGroupRole(role) === ROLE_LEADER;
}

export function canKickGroupMember(actorRole, targetRole) {
    const actor = normalizeGroupRole(actorRole);
    const target = normalizeGroupRole(targetRole);
    return (actor === ROLE_LEADER && [ROLE_CO_LEADER, ROLE_MEMBER].includes(target))
        || (actor === ROLE_CO_LEADER && target === ROLE_MEMBER);
}

export function getMemberRole(member, group, currentUserId) {
    if (group?.owner_id && group.owner_id === currentUserId) return ROLE_LEADER;
    return normalizeGroupRole(member?.role);
}

export function getCurrentUserRole(group, members, currentUserId, fallbackMember) {
    if (!currentUserId) return ROLE_MEMBER;
    if (group?.owner_id === currentUserId) return ROLE_LEADER;
    const member = Array.isArray(members) ? members.find(item => item.user_id === currentUserId) : fallbackMember;
    return normalizeGroupRole(member?.role);
}

export function roleLabelKey(role) {
    const safeRole = normalizeGroupRole(role);
    if (safeRole === ROLE_LEADER) return 'groups.roleLeader';
    if (safeRole === ROLE_CO_LEADER) return 'groups.roleCoLeader';
    return 'groups.member';
}

export function applyRoleBadge(element, role, translate) {
    if (!element) return;
    const safeRole = normalizeGroupRole(role);
    element.classList.remove(...ROLE_CLASSES);
    element.textContent = translate(roleLabelKey(safeRole));
    if (safeRole === ROLE_LEADER) element.classList.add('leader');
    if (safeRole === ROLE_CO_LEADER) element.classList.add('co-leader');
}
