import { t } from '../i18n/i18n.js';
import { getGroupInfo, getGroupMembers } from '../Supabase/Supabase-Group.js';
import { applyRoleBadge, getCurrentUserRole, getMemberRole, isGroupAdmin } from '../groups/groups-roles.js';
import { renderBadge } from '../groups/groups-badges.js';
import { renderGroupMemberActivities } from '../groups/groups-member-activity.js';
import { getNameInitials } from '../utils/name-initials.js';
import { onUserProfileUpdate } from '../profile/profile-events.js';

function memberLabel(count) {
    return count === 1 ? `1 ${t('groups.memberSingle')}` : `${count} ${t('groups.members')}`;
}

export function memberAccounts(member) {
    const profile = profileOf(member);
    const value = profile?.accounts ?? member?.accounts;
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
    const hydrated = Array.isArray(options.entries)
        ? options.entries
        : await hydrateGroups(groupsInfo);
    const groups = hydrated.filter(entry => entry?.group?.id);
    const list = document.querySelector('#groups-list');
    const cards = [];
    groups.forEach(entry => {
        const fragment = document.querySelector('#groups-item-template')?.content.cloneNode(true);
        const item = fragment?.querySelector('.groups-item');
        if (!fragment || !item) return;
        item.dataset.groupId = entry.group.id;
        fragment.querySelector('.groups-item-name').textContent = entry.group.name;
        fragment.querySelector('.groups-item-meta').textContent = memberLabel(entry.members.length);
        renderBadge(fragment.querySelector('.groups-item-logo'), entry.group.badge, entry.group.badge_url);
        const currentRole = getCurrentUserRole(entry.group, entry.members, options.currentUserId, entry.membership);
        applyRoleBadge(fragment.querySelector('.groups-role-badge'), currentRole, t);
        item.addEventListener('click', () => selectGroup(item, entry, options.currentUserId, options.fixture));
        list?.appendChild(fragment);
        cards.push({ item, groupId: entry.group.id });
    });
    const requested = cards.find(card => card.groupId === options.autoOpenGroupId);
    const target = requested || (options.autoOpenFirst ? cards[0] : null);
    target?.item.click();
    return Boolean(target);
}

async function hydrateGroups(groupsInfo) {
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
    return hydrated.filter(Boolean);
}

function selectGroup(item, entry, currentUserId, fixture) {
    document.querySelectorAll('.groups-item.active').forEach(activeItem => {
        activeItem.classList.remove('active');
        activeItem.setAttribute('aria-pressed', 'false');
    });
    item.classList.add('active');
    item.setAttribute('aria-pressed', 'true');
    renderGroupView(entry.group, entry.members, { ...entry, currentUserId, fixture: fixture || entry.fixture || null });
    window.dispatchEvent(new CustomEvent('clashtools:group-selected', { detail: { groupId: entry.group.id } }));
}

export function renderGroupView(group, members, options = {}) {
    const safeMembers = Array.isArray(members) ? members : [];
    const currentUserId = options.currentUserId || localStorage.getItem('id') || '';
    const currentRole = getCurrentUserRole(group, safeMembers, currentUserId, options.membership);
    const summary = groupMemberSummary(safeMembers);
    document.querySelector('#groups-detail-empty')?.classList.add('hidden');
    document.querySelector('#groups-detail-content')?.classList.remove('hidden');
    const detail = document.querySelector('#groups-detail-content');
    if (detail) detail.dataset.groupId = group.id;
    setText('#groups-detail-name', group.name);
    renderBadge(document.querySelector('#groups-detail-logo'), group.badge, group.badge_url);
    setText('#groups-detail-count', memberLabel(summary.members));
    setText('#cf-metric-members', String(summary.members));
    setText('#cf-metric-accounts', String(summary.accounts));
    setText('#groups-inspector-members', String(summary.members));
    setText('#groups-inspector-accounts', String(summary.accounts));
    setText('#cf-metric-clans', String(options.clans?.length || 0));
    setText('#groups-inspector-clans', String(options.clans?.length || 0));
    setText('#groups-detail-tab-clan-count', String(options.clans?.length || 0));
    setText('#groups-detail-tab-member-count', String(summary.members));
    setText('#groups-members-summary', memberLabel(summary.members));
    setText('#groups-detail-code-text', group.code || '------');
    setText('#groups-settings-code-text', group.code || '------');
    setText('#groups-detail-since', `${t('groups.since')} ${formatDate(group.created_at)}`);
    setText('#groups-settings-family-name', group.name);
    applyRoleBadge(document.querySelector('#groups-detail-role'), currentRole, t);
    document.querySelectorAll('[data-current-role]').forEach(node => { node.textContent = currentRole; });
    renderMembers(safeMembers, group, currentUserId, options);
    updateRoleVisibility(currentRole);
    if (!options.fixture) void renderGroupMemberActivities(group.id, safeMembers, document);
    window.dispatchEvent(new CustomEvent('clashtools:group-opened', {
        detail: { group, members: safeMembers, currentRole, canAdmin: isGroupAdmin(currentRole), currentUserId, entry: options, fixture: options.fixture ? options : null }
    }));
}

function renderMembers(members, group, currentUserId, options) {
    const list = document.querySelector('#groups-member-list');
    list?.replaceChildren();
    if (!members.length) {
        list?.appendChild(emptyMessage(t('groups.noMembers')));
        return;
    }
    members.forEach(member => {
        const fragment = document.querySelector('#groups-member-template')?.content.cloneNode(true);
        const item = fragment?.querySelector('.groups-member-item');
        if (!fragment || !item) return;
        const user = profileOf(member) || { id: member.user_id, name: '' };
        const name = String(user.name || '').trim() || t('groups.member');
        const role = getMemberRole(member, { owner_id: group.owner_id }, user.id || member.user_id);
        item.dataset.userId = user.id || member.user_id;
        item.dataset.role = role;
        item.dataset.hasAccounts = memberAccounts(member).length ? 'true' : 'false';
        item.setAttribute('aria-label', `${name}, ${t(roleLabelKey(role))}`);
        fragment.querySelector('.groups-member-name').textContent = name;
        const code = fragment.querySelector('.groups-member-code');
        const publicCode = String(user.code || '').trim();
        code.textContent = publicCode ? `#${publicCode.replace(/^#+/, '')}` : '';
        code.hidden = !publicCode;
        const avatar = fragment.querySelector('.groups-member-avatar');
        avatar.textContent = getNameInitials(name, '?');
        avatar.title = name;
        applyRoleBadge(fragment.querySelector('.groups-role-badge'), role, t);
        renderAccounts(fragment.querySelector('.groups-member-accounts'), memberAccounts(member));
        if (options.fixture) setFixtureActivity(fragment, member);
        item.addEventListener('click', () => window.dispatchEvent(new CustomEvent('clan-family:member-selected', {
            detail: { group, member, members, currentRole: getCurrentUserRole(group, members, currentUserId), currentUserId, fixture: options }
        })));
        list?.appendChild(fragment);
    });
}

function setFixtureActivity(fragment, member) {
    const activity = fragment.querySelector('.groups-member-activity');
    const value = activity?.querySelector('.groups-member-activity-value');
    if (!activity || !value) return;
    activity.dataset.activityState = member.activity ? 'ok' : 'unmeasured';
    activity.classList.remove('is-loading');
    activity.classList.toggle('is-muted', !member.activity);
    value.textContent = member.activity || t('groups.activityNotMeasured');
}

function renderAccounts(container, accounts) {
    container?.replaceChildren();
    if (!accounts.length) {
        container?.appendChild(textNode('span', t('groups.noLinkedAccounts'), 'groups-no-accounts'));
        return;
    }
    accounts.forEach((account, index) => {
        const chip = document.createElement('span');
        chip.className = 'groups-account-chip';
        const name = account?.name || account?.playerName || account?.tag || `${t('groups.account')} ${index + 1}`;
        const tag = account?.tag || account?.playerTag || account?.accountTag || '';
        const townHall = account?.townHallLevel || account?.townHall || '';
        if (townHall) chip.appendChild(textNode('em', `TH${townHall}`));
        chip.append(textNode('strong', name), textNode('span', tag));
        container?.appendChild(chip);
    });
}

function updateRoleVisibility(role) {
    document.querySelectorAll('[data-role-visible]').forEach(element => {
        const allowed = element.dataset.roleVisible.split(',').includes(role);
        element.classList.toggle('hidden', !allowed);
    });
}

function roleLabelKey(role) {
    if (role === 'leader') return 'groups.roleLeader';
    if (role === 'co_leader') return 'groups.roleCoLeader';
    return 'groups.member';
}

function profileOf(member) {
    return Array.isArray(member?.profile) ? member.profile[0] : member?.profile;
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).split('T')[0] || '—';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function emptyMessage(text) {
    return textNode('p', text, 'groups-empty');
}

function textNode(tagName, text, className = '') {
    const node = document.createElement(tagName);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}

function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
}

function applyLiveProfileName(profile) {
    const userId = String(profile?.id || '').trim();
    const name = String(profile?.name || '').trim();
    if (!userId || !name) return;
    document.querySelectorAll('[data-user-id]').forEach(item => {
        if (String(item.dataset.userId || '') !== userId) return;
        const nameElement = item.querySelector('.groups-member-name, .groups-member-drawer-name');
        if (nameElement) nameElement.textContent = name;
        const avatar = item.querySelector('.groups-member-avatar');
        if (avatar) avatar.textContent = getNameInitials(name, '?');
    });
}

onUserProfileUpdate(applyLiveProfileName);

window.addEventListener('clashtools:group-roles-updated', event => {
    const group = event.detail?.group;
    const activeGroupId = document.querySelector('#groups-detail-content')?.dataset.groupId;
    if (!group?.id || activeGroupId !== group.id) return;
    renderGroupView(group, event.detail?.members || [], {
        ...(event.detail?.entry || {}),
        currentUserId: event.detail?.currentUserId || localStorage.getItem('id') || ''
    });
});
