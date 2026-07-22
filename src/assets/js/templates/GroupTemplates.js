import { t } from '../i18n/i18n.js';
import { getGroupInfo, getGroupMembers } from '../Supabase/Supabase-Group.js';
import { applyRoleBadge, getCurrentUserRole, getMemberRole, isGroupAdmin } from '../groups/groups-roles.js';
import { renderBadge } from '../groups/groups-badges.js';
import { renderGroupMemberActivities } from '../groups/groups-member-activity.js';
import { getNameInitials } from '../utils/name-initials.js';

function memberLabel(count) {
    return count === 1 ? `1 ${t('groups.memberSingle')}` : `${count} ${t('groups.members')}`;
}

function memberInitials(name) {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return '?';
    }

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`
        .toUpperCase();
}

export function memberAccounts(member) {
    const profile = profileOf(member);
    const value = profile?.accounts;
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function groupMemberSummary(members) {
    const safeMembers = Array.isArray(members) ? members : [];
    return {
        members: safeMembers.length,
        accounts: safeMembers.reduce((total, member) => total + memberAccounts(member).length, 0),
        leaders: safeMembers.filter(member => ['leader', 'co_leader', 'co-leader'].includes(member?.role)).length
    };
}

export async function createGroupCard(groupsInfo, options = {}) {
    if (!Array.isArray(groupsInfo)) return false;

    const hydrated = await Promise.all(groupsInfo.map(async membership => {
        try {
            const groupData = await getGroupInfo(membership.group_id);
            const group = Array.isArray(groupData) ? groupData[0] : groupData;
            if (!group?.id) return null;
            const membersData = await getGroupMembers(group.id);
            return { membership, group, members: Array.isArray(membersData) ? membersData : [] };
        } catch (error) {
            console.error(error);
            return null;
        }
    }));

    const groups = hydrated.filter(Boolean);
    const list = document.querySelector('#groups-list');
    const cards = [];
    groups.forEach(entry => {
        const fragment = document.querySelector('#groups-item-template').content.cloneNode(true);
        const item = fragment.querySelector('.groups-item');
        item.dataset.groupId = entry.group.id;
        fragment.querySelector('.groups-item-name').textContent = entry.group.name;
        fragment.querySelector('.groups-item-meta').textContent = memberLabel(entry.members.length);
        renderBadge(fragment.querySelector('.groups-item-logo'), entry.group.badge, entry.group.badge_url);
        const currentRole = getCurrentUserRole(entry.group, entry.members, localStorage.getItem('id'), entry.membership);
        applyRoleBadge(fragment.querySelector('.groups-role-badge'), currentRole, t);
        item.addEventListener('click', () => {
            document.querySelectorAll('.groups-item.active').forEach(activeItem => {
                activeItem.classList.remove('active');
                activeItem.setAttribute('aria-selected', 'false');
            });
            item.classList.add('active');
            item.setAttribute('aria-selected', 'true');
            openGroup(entry.group, entry.members);
            options.onSelect?.(entry.group.id);
        });
        list?.appendChild(fragment);
        cards.push({ item, groupId: entry.group.id });
    });

    const requested = cards.find(card => card.groupId === options.autoOpenGroupId);
    const target = requested || (options.autoOpenFirst ? cards[0] : null);
    target?.item.click();
    return Boolean(target);
}

function openGroup(group, members) {
    renderGroupView(group, members, true);
}

function renderGroupView(group, members, dispatch) {
    const safeMembers = Array.isArray(members) ? members : [];
    document.querySelector('#groups-detail-empty')?.classList.add('hidden');
    document.querySelector('#groups-detail-content')?.classList.remove('hidden');
    setText('#groups-detail-name', group.name);
    renderBadge(document.querySelector('#groups-detail-logo'), group.badge, group.badge_url);

    const summary = groupMemberSummary(safeMembers);
    const memberText = memberLabel(summary.members);
    setText('#groups-detail-count', memberText);
    setText('#groups-detail-tab-member-count', String(summary.members));
    setText('#groups-members-summary', memberText);
    setText('#groups-detail-code-text', group.code || '------');
    setText('#groups-detail-since', `${t('groups.since')} ${formatDate(group.created_at)}`);
    setText('#groups-inspector-name', group.name);
    setText('#groups-inspector-description', t('groups.inspectorDescription', { name: group.name }));
    setText('#groups-inspector-members', String(summary.members));
    setText('#groups-inspector-accounts', String(summary.accounts));
    setText('#groups-inspector-leaders', String(summary.leaders));
    setText('#groups-inspector-clans', '—');
    document.querySelector('#groups-inspector-management')?.classList.remove('hidden');

    const currentRole = getCurrentUserRole(group, safeMembers, localStorage.getItem('id'));
    const canAdmin = isGroupAdmin(currentRole);
    applyRoleBadge(document.querySelector('#groups-detail-role'), currentRole, t);
    document.querySelectorAll('.groups-admin-only').forEach(element => element.classList.toggle('hidden', !canAdmin));
    document.querySelectorAll('.groups-member-only').forEach(element => element.classList.toggle('hidden', canAdmin));
    addAllMembers(safeMembers, group.owner_id);
    void renderGroupMemberActivities(group.id, safeMembers, document);

    if (dispatch) {
        window.dispatchEvent(new CustomEvent('clashtools:group-opened', { detail: { group, members: safeMembers, currentRole, canAdmin } }));
    }
}

function addAllMembers(members, creatorId) {
    const memberList = document.querySelector('#groups-member-list');
    memberList?.replaceChildren();
    if (!members.length) {
        const empty = document.createElement('p');
        empty.className = 'groups-empty';
        empty.textContent = t('groups.noMembers');
        memberList?.appendChild(empty);
        return;
    }

    members.forEach(member => {
        const fragment = document.querySelector('#groups-member-template').content.cloneNode(true);
        const item = fragment.querySelector('.groups-member-item');
        const user = profileOf(member) || {
            id: member.user_id,
            name: member.user_id
        };

        const displayName = user.name || member.user_id;

        item.dataset.userId = user.id || member.user_id;

        fragment.querySelector('.groups-member-name').textContent =
            displayName;

        fragment.querySelector('.groups-member-code').textContent =
            user.code || member.user_id;

        const avatar = fragment.querySelector(
            '.groups-member-avatar'
        );

        if (avatar) {
            avatar.textContent = getNameInitials(
                displayName,
                '?'
            );

            avatar.title = displayName;
        }

        applyRoleBadge(fragment.querySelector('.groups-role-badge'), getMemberRole(member, { owner_id: creatorId }, user.id || member.user_id), t);
        renderAccounts(fragment.querySelector('.groups-member-accounts'), memberAccounts(member));
        memberList?.appendChild(fragment);
    });
}

function renderAccounts(container, accounts) {
    container?.replaceChildren();
    if (!accounts.length) {
        const empty = document.createElement('span');
        empty.className = 'groups-no-accounts';
        empty.textContent = t('groups.noLinkedAccounts');
        container?.appendChild(empty);
        return;
    }
    accounts.forEach((account, index) => {
        const chip = document.createElement('span');
        chip.className = 'groups-account-chip';
        const name = account?.name || account?.playerName || account?.tag || account?.playerTag || `${t('groups.account')} ${index + 1}`;
        const tag = account?.tag || account?.playerTag || account?.accountTag || '';
        const townHall = account?.townHallLevel || account?.townHall || '';
        if (townHall) chip.appendChild(textNode('em', `TH${townHall}`));
        chip.appendChild(textNode('strong', name));
        if (tag) chip.appendChild(textNode('span', tag));
        container?.appendChild(chip);
    });
}

function profileOf(member) {
    return Array.isArray(member?.profile) ? member.profile[0] : member?.profile;
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).split('T')[0] || '—';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'nl', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function textNode(tagName, text) {
    const node = document.createElement(tagName);
    node.textContent = text;
    return node;
}

function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
}

window.addEventListener('clashtools:group-roles-updated', event => {
    const group = event.detail?.group;
    const activeGroupId = document.querySelector('.groups-item.active')?.dataset.groupId;
    if (!group?.id || activeGroupId !== group.id) return;
    renderGroupView(group, event.detail?.members || [], false);
});