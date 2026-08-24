import { getClanInfoRequest, getClanMembersRequest } from '../API/API-Clan.js';
import { addGroupClan, getGroupClans, getGroupInfo, removeGroupClan } from '../Supabase/Supabase-Group.js';
import { t } from '../i18n/i18n.js';
import { withGlobalLoading } from '../utils/loading-state.js';
import { renderBadge } from './groups-badges.js';
import { familyCopy } from './clan-family-copy.js';

export function createClanAdmin(elements, getState, setMessage, emptyMessage) {
    let linkedClans = [];
    let auditState = 'not-run';

    function setLinkedClans(clans, groupId = getState().group?.id) {
        linkedClans = Array.isArray(clans) ? clans : [];
        renderLinkedClans();
        if (groupId) window.dispatchEvent(new CustomEvent('clan-family:clans-updated', { detail: { groupId, clans: linkedClans } }));
    }

    function load() {
        const state = getState();
        if (!state.group || !state.userId) return Promise.resolve();
        if (state.entry?.fixture) {
            setLinkedClans(state.entry.clans || [], state.group.id);
            auditState = state.entry.auditState || (state.entry.auditIssues?.length ? 'issues' : 'not-run');
            renderAudit(state.entry.auditIssues || []);
            return Promise.resolve();
        }
        const requestedGroupId = state.group.id;
        return withGlobalLoading(() => Promise.all([getGroupClans(requestedGroupId), getGroupInfo(requestedGroupId)])
            .then(([clans, groupData]) => {
                if (getState().group?.id !== requestedGroupId) return;
                setLinkedClans(clans, requestedGroupId);
                applyFreshGroupBadge(Array.isArray(groupData) ? groupData[0] : groupData);
                auditState = 'not-run';
                renderAudit([]);
            })
            .catch(error => {
                if (getState().group?.id !== requestedGroupId) return;
                console.error(error);
                setLinkedClans([], requestedGroupId);
                setMessage(t('groups.linkedClansLoadError'));
                renderAudit([], 'error');
            }), t('groups.loading'));
    }

    function applyFreshGroupBadge(freshGroup) {
        const group = getState().group;
        if (!group || !freshGroup?.id || freshGroup.id !== group.id) return;
        group.badge = freshGroup.badge || group.badge;
        group.badge_url = freshGroup.badge_url || '';
        renderBadge(document.querySelector('#groups-detail-logo'), group.badge, group.badge_url);
        renderBadge(document.querySelector('.groups-item.active .groups-item-logo'), group.badge, group.badge_url);
    }

    function add() {
        const { group, userId, canAdmin } = getState();
        const tag = normalizeTag(elements.clanTag?.value);
        if (!group || !userId || !canAdmin || !tag) return setMessage(t('groups.enterClanTag'));
        if (getState().entry?.fixture) return setMessage(familyCopy('noManagement'));
        if (linkedClans.some(clan => normalizeTag(clan.clan_tag) === tag)) return setMessage(t('groups.clanAlreadyLinked'));
        withGlobalLoading(() => getClanInfoRequest(tag)
            .then(info => addGroupClan(group.id, { tag: normalizeTag(info?.tag || tag), name: info?.name || tag, badgeUrl: badgeUrl(info) }))
            .then(async () => {
                if (elements.clanTag) elements.clanTag.value = '';
                setMessage(t('groups.clanLinked'), 'success');
                await load();
            })
            .catch(error => { console.error(error); setMessage(t('groups.clanLinkError')); }), t('groups.loading'));
    }

    function remove(clanTag) {
        const { group, userId, canAdmin } = getState();
        const tag = normalizeTag(clanTag);
        if (!group || !userId || !canAdmin || !tag) return;
        if (getState().entry?.fixture) return setMessage(familyCopy('noManagement'));
        withGlobalLoading(() => removeGroupClan(group.id, tag)
            .then(async () => { setMessage(t('groups.clanRemoved'), 'success'); await load(); })
            .catch(error => { console.error(error); setMessage(t('groups.clanRemoveError')); }), t('groups.loading'));
    }

    function renderLinkedClans() {
        elements.linkedClans?.replaceChildren();
        if (!linkedClans.length) {
            elements.linkedClans?.appendChild(emptyMessage(t('groups.noLinkedClans')));
            return;
        }
        linkedClans.forEach(clan => elements.linkedClans?.appendChild(linkedClanNode(clan)));
    }

    function linkedClanNode(clan) {
        const item = document.createElement('article');
        item.className = 'cf-clan-row';
        const badge = document.createElement('div');
        badge.className = 'groups-linked-clan-badge';
        renderBadge(badge, 'banner', clan.badge_url);
        const text = document.createElement('div');
        text.className = 'cf-clan-row-copy';
        const name = document.createElement('strong');
        name.textContent = clan.clan_name || clan.clan_tag;
        const meta = document.createElement('span');
        const primary = clan.is_primary ? ` · ${t('groups.primaryClan')}` : '';
        meta.textContent = `${normalizeTag(clan.clan_tag)} · ${clan.member_count || '—'} ${t('groups.members')}${primary}`;
        text.append(name, meta);
        const actions = document.createElement('div');
        actions.className = 'cf-row-actions';
        const open = document.createElement('a');
        open.className = 'button button-secondary button-small';
        open.href = '/app/cwl-tracker';
        open.textContent = familyCopy('open');
        open.setAttribute('aria-label', `${familyCopy('open')} ${clan.clan_name || clan.clan_tag}`);
        actions.appendChild(open);
        if (getState().canAdmin) actions.appendChild(actionButton(t('groups.removeClan'), () => remove(clan.clan_tag), 'button-danger'));
        item.append(badge, text, actions);
        return item;
    }

    function scan() {
        const state = getState();
        if (!linkedClans.length) return renderAudit([], 'empty');
        if (state.entry?.fixture) {
            auditState = state.entry.auditIssues?.length ? 'issues' : 'clean';
            renderAudit(state.entry.auditIssues || []);
            return;
        }
        auditState = 'loading';
        renderAudit([]);
        withGlobalLoading(() => findUnlinkedAccounts(state.members).then(accounts => {
            auditState = accounts.length ? 'issues' : 'clean';
            renderAudit(accounts);
        }).catch(error => {
            console.error(error);
            auditState = 'error';
            renderAudit([], 'error');
        }), t('groups.loading'));
    }

    function renderAudit(accounts, state = auditState) {
        elements.auditStatus.textContent = state === 'issues'
            ? familyCopy('auditIssues')
            : state === 'clean'
                ? familyCopy('auditClean')
                : state === 'error'
                    ? t('groups.scanError')
                    : state === 'empty'
                        ? t('groups.noLinkedClans')
                        : familyCopy('auditNotRun');
        elements.auditStatus.dataset.state = state;
        elements.unlinkedAccounts?.replaceChildren();
        if (state === 'loading') return elements.unlinkedAccounts?.appendChild(emptyMessage(t('groups.loading')));
        if (state === 'not-run') return elements.unlinkedAccounts?.appendChild(emptyMessage(t('groups.scanFirst')));
        if (state === 'error') return elements.unlinkedAccounts?.appendChild(emptyMessage(t('groups.scanError')));
        if (state === 'empty') return elements.unlinkedAccounts?.appendChild(emptyMessage(t('groups.noLinkedClans')));
        if (!accounts.length) return elements.unlinkedAccounts?.appendChild(emptyMessage(t('groups.noUnlinkedAccounts')));
        accounts.forEach(account => elements.unlinkedAccounts?.appendChild(unlinkedNode(account)));
        window.dispatchEvent(new CustomEvent('clan-family:audit-updated', { detail: { groupId: getState().group?.id, issues: accounts, state } }));
    }

    async function findUnlinkedAccounts(members) {
        const linkedTags = getLinkedAccountTags(members);
        const missing = [];
        for (const clan of linkedClans) {
            const liveMembers = memberItems(await getClanMembersRequest(normalizeTag(clan.clan_tag)));
            liveMembers.forEach(member => addMissingMember(missing, member, linkedTags, clan));
        }
        return missing;
    }

    function getLinkedAccountTags(members) {
        const tags = new Set();
        (members || []).forEach(member => parseAccounts(profileOf(member)?.accounts ?? member.accounts).forEach(account => {
            const tag = normalizeTag(account?.tag || account?.playerTag || account?.accountTag || account?.clashTag);
            if (tag) tags.add(tag);
        }));
        return tags;
    }

    function addMissingMember(missing, member, linkedTags, clan) {
        const tag = normalizeTag(member?.tag);
        if (!tag || linkedTags.has(tag)) return;
        missing.push({ name: member?.name || tag, tag, townHall: member?.townHallLevel || member?.townHall || '', clan: clan.clan_name });
    }

    function unlinkedNode(account) {
        const item = document.createElement('div');
        item.className = 'cf-audit-row';
        const copy = document.createElement('span');
        copy.append(textNode('strong', account.name), textNode('small', `${account.townHall ? `TH${account.townHall} · ` : ''}${account.tag} · ${account.clan}`));
        item.append(copy, textNode('span', t('groups.notLinkedToMember'), 'cf-audit-status'));
        return item;
    }

    function reset() {
        linkedClans = [];
        auditState = 'not-run';
        renderLinkedClans();
        renderAudit([]);
    }

    elements.addClan?.addEventListener('click', add);
    elements.clanTag?.addEventListener('keydown', event => { if (event.key === 'Enter') add(); });
    elements.scanUnlinked?.addEventListener('click', scan);
    elements.retry?.addEventListener('click', load);
    return { load, reset, scan };
}

function queryElements() {
    return {
        clanTag: document.querySelector('#groups-admin-clan-tag'),
        addClan: document.querySelector('#groups-admin-add-clan'),
        linkedClans: document.querySelector('#groups-clan-list'),
        scanUnlinked: document.querySelector('#groups-admin-scan-unlinked'),
        unlinkedAccounts: document.querySelector('#groups-unlinked-accounts'),
        auditStatus: document.querySelector('#groups-audit-status'),
        retry: document.querySelector('#groups-clans-retry')
    };
}

function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    return tag ? (tag.startsWith('#') ? tag : `#${tag}`) : '';
}

function badgeUrl(info) {
    return info?.badgeUrls?.small || info?.badgeUrls?.medium || info?.badgeUrls?.large || '';
}

function profileOf(member) {
    return Array.isArray(member?.profile) ? member.profile[0] : member?.profile;
}

function parseAccounts(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function memberItems(response) {
    if (Array.isArray(response)) return response;
    return Array.isArray(response?.items) ? response.items : Array.isArray(response?.memberList) ? response.memberList : [];
}

function actionButton(label, onClick, style) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button button-small ${style || 'button-secondary'}`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

function textNode(tag, text, className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}
