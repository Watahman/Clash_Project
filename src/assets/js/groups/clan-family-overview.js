import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { familyCopy } from './clan-family-copy.js?v=20260829-public-auth-v1';
import { renderBadge } from './groups-badges.js';
import { groupMemberSummary } from '../templates/GroupTemplates.js?v=20260829-public-auth-v1';

let currentEntry = null;
let currentDetail = null;

export function initClanFamilyOverview(onAction) {
    window.addEventListener('clashtools:group-opened', event => {
        currentDetail = event.detail || null;
        currentEntry = event.detail?.entry || {};
        renderOverview(event.detail, currentEntry);
    });
    window.addEventListener('clan-family:clans-updated', event => {
        if (!isCurrentGroup(event.detail?.groupId)) return;
        currentEntry = { ...currentEntry, clans: event.detail.clans || [] };
        renderOverview({ ...currentDetail, ...event.detail }, currentEntry);
    });
    window.addEventListener('clan-family:polls-updated', event => {
        if (!isCurrentGroup(event.detail?.groupId)) return;
        currentEntry = { ...currentEntry, polls: event.detail.polls || [] };
        renderOverview({ ...currentDetail, ...event.detail }, currentEntry);
    });
    window.addEventListener('clan-family:audit-updated', event => {
        if (!isCurrentGroup(event.detail?.groupId)) return;
        currentEntry = { ...currentEntry, auditIssues: event.detail.issues || [], auditState: event.detail.state };
        renderOverview({ ...currentDetail, ...event.detail }, currentEntry);
    });
    document.addEventListener('click', event => {
        const action = event.target.closest('[data-family-action]');
        if (!action) return;
        event.preventDefault();
        onAction?.(action.dataset.familyAction);
    });
}

function renderOverview(detail, entry) {
    const members = Array.isArray(detail?.members) ? detail.members : [];
    const summary = groupMemberSummary(members);
    const clans = Array.isArray(entry?.clans) ? entry.clans : [];
    const polls = Array.isArray(entry?.polls) ? entry.polls : [];
    const activePolls = polls.filter(poll => poll.type === 'cwl_availability' && poll.status === 'open');
    setMetric('members', summary.members);
    setMetric('accounts', summary.accounts);
    setMetric('clans', clans.length);
    setMetric('polls', activePolls.length);
    renderReadiness(summary, clans, activePolls, entry);
    renderAttention(summary, clans, activePolls, entry, detail?.currentUserId);
    renderClanPreview(clans);
}

function renderReadiness(summary, clans, polls, entry) {
    const items = [];
    if (!clans.length) items.push(actionItem('clans', t('groups.addClan'), t('groups.noLinkedClans')));
    if (!summary.accounts) items.push(actionItem('members', t('groups.accounts'), t('groups.noLinkedAccounts')));
    if (!polls.length) items.push(actionItem('polls', familyCopy('activePoll'), familyCopy('pollHelp')));
    if (Array.isArray(entry?.auditIssues) && entry.auditIssues.length) {
        items.push(actionItem('clans', t('groups.accountAudit'), familyCopy('auditIssues')));
    }
    const list = document.querySelector('#cf-readiness-list');
    list?.replaceChildren();
    if (!items.length) {
        list?.appendChild(actionItem('', familyCopy('ready'), t('groups.inspectorDescription', { name: 'Clan Family' }), 'is-complete'));
        setStatus(familyCopy('ready'), 'success');
    } else {
        items.forEach(item => list?.appendChild(item));
        setStatus(familyCopy('needsAttention'), 'warning');
    }
}

function renderAttention(summary, clans, polls, entry, currentUserId) {
    const list = document.querySelector('#cf-attention-list');
    list?.replaceChildren();
    const activePoll = polls[0];
    const answered = activePoll ? Object.keys(activePoll.answers || {}).length : 0;
    if (activePoll && !activePoll.answers?.[currentUserId]) {
        list?.appendChild(actionItem('polls', activePoll.title, `${Math.max(0, summary.members - answered)} ${familyCopy('responses')} ${familyCopy('pending')}`));
    }
    if (entry?.auditIssues?.length) list?.appendChild(actionItem('clans', t('groups.accountAudit'), `${entry.auditIssues.length} ${t('groups.unlinkedAccounts').toLowerCase()}`));
    if (!list?.children.length) list?.appendChild(actionItem('', familyCopy('ready'), t('groups.noActivePollHelp'), 'is-quiet'));
}

function renderClanPreview(clans) {
    const list = document.querySelector('#cf-overview-clans');
    list?.replaceChildren();
    if (!clans.length) {
        list?.appendChild(actionItem('clans', t('groups.noLinkedClans'), t('groups.clansSharedHelp')));
        return;
    }
    clans.slice(0, 4).forEach(clan => {
        const row = document.createElement('div');
        row.className = 'cf-preview-row';
        const badge = document.createElement('span');
        badge.className = 'cf-preview-badge';
        renderBadge(badge, 'banner', clan.badge_url);
        const copy = document.createElement('span');
        copy.append(textNode('strong', clan.clan_name || clan.clan_tag), textNode('small', clan.clan_tag || ''));
        row.append(badge, copy);
        list?.appendChild(row);
    });
}

function actionItem(tab, title, body, className = '') {
    const item = document.createElement(tab ? 'button' : 'div');
    item.className = `cf-action-row ${className}`.trim();
    if (tab) {
        item.type = 'button';
        item.dataset.familyAction = tab;
    }
    const text = document.createElement('span');
    text.className = 'cf-action-copy';
    text.append(textNode('strong', title), textNode('small', body));
    item.append(text);
    if (tab) item.append(icon('chevron-right', familyCopy('open')));
    return item;
}

function setMetric(name, value) {
    const node = document.querySelector(`#cf-metric-${name}`);
    if (node) node.textContent = String(value);
}

function setStatus(label, state) {
    const node = document.querySelector('#cf-readiness-status');
    if (!node) return;
    node.textContent = label;
    node.dataset.state = state;
}

function isCurrentGroup(groupId) {
    return Boolean(groupId && groupId === document.querySelector('#groups-detail-content')?.dataset.groupId);
}

function icon(name, label = '') {
    const image = document.createElement('img');
    image.src = `/assets/icons/ui/${name}.svg`;
    image.alt = label;
    image.width = 16;
    image.height = 16;
    image.setAttribute('aria-hidden', label ? 'false' : 'true');
    return image;
}

function textNode(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
}
