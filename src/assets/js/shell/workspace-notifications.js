import { getNotifications, markNotificationRead } from '../Supabase/Supabase-Notifications.js';
import { t } from '../i18n/i18n.js';
import {
    buildGroupPollHref,
    pollNotificationCopy,
    stageGroupPollNavigation
} from '../notifications/poll-notifications.js';
import { getCurrentUserId } from '../utils/user.js';

let notificationsData;
let requestId = 0;

function setNotificationsCount(count) {
    const badge = document.querySelector('#workspace-notifications-count');
    if (!badge) return;
    const safeCount = Math.max(0, Number(count) || 0);
    badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
    badge.classList.toggle('hidden', safeCount === 0);
}
async function openNotification(notification, data, unread, button) {
    const userId = getCurrentUserId();
    if (!notification.read_at && userId) {
        await markNotificationRead(userId, notification.id).catch(() => null);
        notification.read_at = new Date().toISOString();
        button.classList.remove('unread');
        data.unread = Math.max(0, Number(data.unread ?? unread) - 1);
        setNotificationsCount(data.unread);
        window.dispatchEvent(new CustomEvent('clashtools:notifications-updated', { detail: { items: data.items } }));
    }
    if (!notification.related_group_id) return;
    const pollHref = buildGroupPollHref(notification, window.location.href);
    stageGroupPollNavigation(notification, sessionStorage, localStorage);
    window.location.href = pollHref || '/app/clan-management';
}

function notificationButton(notification, data, unread) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'workspace-notification-item';
    button.classList.toggle('unread', !notification.read_at);
    const copy = pollNotificationCopy(notification, t);
    const title = document.createElement('strong');
    title.textContent = copy.title;
    const body = document.createElement('span');
    body.textContent = copy.body;
    button.append(title, body);
    button.addEventListener('click', () => void openNotification(notification, data, unread, button));
    return button;
}

function renderNotifications(data) {
    const list = document.querySelector('#workspace-notifications-list');
    if (!list) return;
    const items = Array.isArray(data?.items) ? data.items : [];
    const unread = Number(data?.unread ?? items.filter(item => !item.read_at).length);
    setNotificationsCount(unread);
    window.dispatchEvent(new CustomEvent('clashtools:notifications-updated', { detail: { items } }));
    list.replaceChildren();
    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'workspace-notifications-empty';
        empty.textContent = t('notifications.empty');
        list.appendChild(empty);
        return;
    }
    items.forEach(notification => list.appendChild(notificationButton(notification, data, unread)));
}

function showNotificationMessage(messageKey, className = '') {
    const list = document.querySelector('#workspace-notifications-list');
    if (!list) return;
    list.replaceChildren();
    const message = document.createElement('p');
    message.className = `workspace-notifications-empty ${className}`.trim();
    message.textContent = t(messageKey);
    list.appendChild(message);
}

export async function loadWorkspaceNotifications({ showLoading = false } = {}) {
    const panel = document.querySelector('#workspace-notifications-panel');
    const userId = getCurrentUserId();
    const currentRequest = ++requestId;
    if (!panel) return;
    if (!userId) {
        notificationsData = { items: [], unread: 0 };
        renderNotifications(notificationsData);
        return;
    }
    if (showLoading && !notificationsData) showNotificationMessage('profile.loading');
    panel.setAttribute('aria-busy', 'true');
    try {
        const data = await getNotifications(userId);
        if (currentRequest !== requestId) return;
        notificationsData = data || { items: [], unread: 0 };
        renderNotifications(notificationsData);
    } catch {
        if (currentRequest === requestId) showNotificationMessage('profile.loadError', 'workspace-notifications-error');
    } finally {
        if (currentRequest === requestId) panel.removeAttribute('aria-busy');
    }
}

function bindNotificationEvents(close) {
    const root = document.querySelector('#workspace-notifications-root');
    const panel = document.querySelector('#workspace-notifications-panel');
    document.addEventListener('pointerdown', event => {
        if (!panel.classList.contains('hidden') && !root.contains(event.target)) close();
    });
    document.addEventListener('keydown', event => event.key === 'Escape' && close(true));
    window.addEventListener('clashtools:language-changed', () => notificationsData && renderNotifications(notificationsData));
    window.addEventListener('clashtools:notifications-requested', () => notificationsData && renderNotifications(notificationsData));
    window.addEventListener('clashtools:notifications-refresh-requested', () => void loadWorkspaceNotifications());
}

export function initNotificationsPopover() {
    const root = document.querySelector('#workspace-notifications-root');
    const button = document.querySelector('#workspace-notifications');
    const panel = document.querySelector('#workspace-notifications-panel');
    const closeButton = document.querySelector('#workspace-notifications-close');
    if (!root || !button || !panel || !closeButton) return;
    const close = (restoreFocus = false) => {
        if (panel.classList.contains('hidden')) return;
        panel.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus) button.focus();
    };
    button.addEventListener('click', () => {
        if (!panel.classList.contains('hidden')) return close();
        panel.classList.remove('hidden');
        button.setAttribute('aria-expanded', 'true');
        void loadWorkspaceNotifications({ showLoading: true });
        window.requestAnimationFrame(() => closeButton.focus());
    });
    closeButton.addEventListener('click', () => close(true));
    bindNotificationEvents(close);
}
