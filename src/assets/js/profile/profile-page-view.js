import { getTownHallAsset, installImageFallback, ASSET_FALLBACKS } from '../assets/entity-assets.js';
import { getNameInitials } from '../utils/name-initials.js';
import { getLanguage, t } from '../i18n/i18n.js';

function node(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function friendProfile(value) {
    const profile = value?.profile || value || {};
    return {
        id: profile.id || value?.user_b || value?.user_a || '',
        name: profile.name || profile.id || value?.user_b || value?.user_a || t('header.user'),
        code: profile.code || ''
    };
}

function empty(container, key) {
    container.replaceChildren(node('p', 'profile-list-empty', t(key)));
}

function actionButton(labelKey, action, variant = 'secondary') {
    const button = node('button', `cp-button cp-button--${variant}`, t(labelKey));
    button.type = 'button';
    button.addEventListener('click', action);
    return button;
}

export function renderIdentity(profile) {
    const name = String(profile?.name || t('header.user')).trim();
    document.querySelector('#profile-name').textContent = name;
    document.querySelector('#profile-avatar').textContent = getNameInitials(name, 'CT');
    document.querySelector('#profile-email').textContent = profile?.email || '';
    const codeButton = document.querySelector('#profile-code');
    const code = String(profile?.code || '').replace(/^#/, '');
    document.querySelector('#profile-code-value').textContent = code ? `#${code}` : '';
    codeButton.dataset.copyValue = code;
    codeButton.hidden = !code;
}

export function renderOverview(profile, friends, groups) {
    const date = profile?.created_at ? new Date(profile.created_at) : null;
    document.querySelector('#profile-member-since').textContent = date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium' }).format(date)
        : '—';
    document.querySelector('#profile-account-count').textContent = String(profile?.accounts?.length || 0);
    document.querySelector('#profile-friend-count').textContent = String(friends.length);
    document.querySelector('#profile-family-count').textContent = String(groups.length);
}

export function renderAccounts(accounts = []) {
    const container = document.querySelector('#profile-account-list');
    container.replaceChildren();
    if (!accounts.length) return empty(container, 'profilePage.noAccounts');
    accounts.forEach(account => {
        const item = node('article', 'profile-list-item');
        const image = node('img');
        image.src = getTownHallAsset(account.townHallLevel || account.town_hall_level);
        image.alt = '';
        installImageFallback(image, ASSET_FALLBACKS.account);
        const copy = node('span', 'profile-list-copy');
        copy.append(
            node('strong', '', account.name || t('profilePage.clashAccount')),
            node('span', '', account.tag || ''),
            node('small', '', t('profilePage.verified'))
        );
        const badge = node('span', 'cp-status cp-status--success', t('profilePage.verified'));
        item.append(image, copy, badge);
        container.appendChild(item);
    });
}

export function renderFriendList(kind, state, handlers = {}) {
    const container = document.querySelector('#profile-friend-list');
    const values = kind === 'requests' ? state.requests : kind === 'sent' ? state.sent : state.friends;
    container.replaceChildren();
    const emptyKey = kind === 'requests'
        ? 'profilePage.noRequests'
        : kind === 'sent' ? 'profilePage.noSentRequests' : 'profile.noFriends';
    if (!values.length) return empty(container, emptyKey);
    values.forEach(value => container.appendChild(friendRow(value, kind, handlers)));
}

function friendRow(value, kind, handlers) {
    const profile = friendProfile(value);
    const item = node('article', 'profile-list-item');
    const avatar = node('span', 'profile-list-avatar', getNameInitials(profile.name, 'CP'));
    const copy = node('span', 'profile-list-copy');
    copy.append(node('strong', '', profile.name), node('small', '', profile.code ? `#${profile.code}` : ''));
    const actions = node('span', 'profile-list-actions');
    if (kind === 'requests') {
        actions.append(
            actionButton('profile.acceptFriend', () => handlers.accept?.(profile.id), 'primary'),
            actionButton('profile.rejectFriend', () => handlers.reject?.(profile.id), 'secondary')
        );
    } else if (kind === 'sent') {
        actions.append(node('span', 'cp-status', t('profile.waitingAcceptance')));
    }
    item.append(avatar, copy, actions);
    return item;
}

export function profileFixtureData() {
    return {
        profile: {
            id: 'fixture-profile',
            name: 'Ember League',
            email: 'leader@example.com',
            code: 'CP8X2Q',
            created_at: '2025-09-12T12:00:00Z',
            accounts: [
                { name: 'Ember Crown', tag: '#2PPQ9L8', townHallLevel: 17 },
                { name: 'Forge Mini', tag: '#8LG2J0Q', townHallLevel: 14 }
            ]
        },
        friends: [{ profile: { id: 'friend-one', name: 'Nova', code: 'PX4RT' } }],
        requests: [{ profile: { id: 'request-one', name: 'Ironvale', code: 'Q8V2M' } }],
        sent: [{ profile: { id: 'sent-one', name: 'Northstar', code: 'C7K9L' } }],
        groups: [{ group_id: 'family-one', role: 'leader' }]
    };
}
