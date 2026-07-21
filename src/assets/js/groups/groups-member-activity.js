import { getGroupMemberActivity } from '../Supabase/Supabase-Group.js';
import { getLanguage, t } from '../i18n/i18n.js';

let renderVersion = 0;
let relativeTimeTimer;

const SOURCE_KEYS = Object.freeze({
    ranked_attack: 'groups.activitySourceRanked',
    attack: 'groups.activitySourceAttack',
    defense: 'groups.activitySourceDefense',
    war_attack: 'groups.activitySourceWarAttack',
    donation: 'groups.activitySourceDonation',
    capital: 'groups.activitySourceCapital',
    builder_attack: 'groups.activitySourceBuilder',
    progress: 'groups.activitySourceProgress'
});

export async function renderGroupMemberActivities(groupId, members, root = document) {
    const version = ++renderVersion;
    const safeMembers = Array.isArray(members) ? members : [];
    const rows = memberRows(root);

    safeMembers.forEach(member => {
        const userId = String(member?.user_id || member?.profile?.id || '').trim();
        const row = rows.get(userId);
        if (!row) return;
        const accounts = memberAccounts(member);
        setRowState(row, accounts.length ? 'loading' : 'no_accounts');
    });

    if (!groupId || !rows.size) return;

    try {
        const response = await getGroupMemberActivity(groupId, { forceRefresh: true });
        if (version !== renderVersion) return;

        const activityByUser = new Map(
            (Array.isArray(response?.members) ? response.members : [])
                .map(activity => [String(activity?.userId || ''), activity])
        );

        safeMembers.forEach(member => {
            const userId = String(member?.user_id || member?.profile?.id || '').trim();
            const row = rows.get(userId);
            if (!row) return;
            applyActivity(row, activityByUser.get(userId));
        });
        startRelativeTimeTicker(root);
    } catch (error) {
        if (version !== renderVersion) return;
        safeMembers.forEach(member => {
            const userId = String(member?.user_id || member?.profile?.id || '').trim();
            const row = rows.get(userId);
            if (!row || row.dataset.activityState === 'no_accounts') return;
            setRowState(row, 'unavailable');
        });
        console.error(error);
    }
}

export function refreshGroupActivityLabels(root = document) {
    root.querySelectorAll('.groups-member-activity[data-activity-at]').forEach(row => {
        const timestamp = row.dataset.activityAt;
        const value = row.querySelector('.groups-member-activity-value');
        if (value) value.textContent = formatLastActivity(timestamp);
        updateActivityTitle(row);
    });
}

export function formatLastActivity(timestamp, language = getLanguage(), now = Date.now()) {
    const time = new Date(timestamp).getTime();
    if (!Number.isFinite(time)) return '';

    const elapsedSeconds = Math.max(0, Math.floor((now - time) / 1000));
    if (elapsedSeconds < 60) return relativeLabel(language, 0, 'now');
    if (elapsedSeconds < 3600) return relativeLabel(language, Math.max(1, Math.floor(elapsedSeconds / 60)), 'minute');
    if (elapsedSeconds < 86400) return relativeLabel(language, Math.floor(elapsedSeconds / 3600), 'hour');
    if (elapsedSeconds < 7 * 86400) return relativeLabel(language, Math.floor(elapsedSeconds / 86400), 'day');
    if (elapsedSeconds < 30 * 86400) return relativeLabel(language, Math.floor(elapsedSeconds / (7 * 86400)), 'week');
    if (elapsedSeconds < 365 * 86400) return relativeLabel(language, Math.floor(elapsedSeconds / (30 * 86400)), 'month');
    return relativeLabel(language, Math.floor(elapsedSeconds / (365 * 86400)), 'year');
}

function relativeLabel(language, amount, unit) {
    const labels = {
        nl: {
            now: 'nu',
            minute: value => `${value}m geleden`,
            hour: value => `${value}u geleden`,
            day: value => `${value}d geleden`,
            week: value => `${value}w geleden`,
            month: value => `${value}mnd geleden`,
            year: value => `${value}j geleden`
        },
        en: {
            now: 'now',
            minute: value => `${value}m ago`,
            hour: value => `${value}h ago`,
            day: value => `${value}d ago`,
            week: value => `${value}w ago`,
            month: value => `${value}mo ago`,
            year: value => `${value}y ago`
        },
        fr: {
            now: 'maintenant',
            minute: value => `il y a ${value} min`,
            hour: value => `il y a ${value} h`,
            day: value => `il y a ${value} j`,
            week: value => `il y a ${value} sem`,
            month: value => `il y a ${value} mois`,
            year: value => `il y a ${value} an`
        },
        de: {
            now: 'jetzt',
            minute: value => `vor ${value} Min.`,
            hour: value => `vor ${value} Std.`,
            day: value => `vor ${value} T.`,
            week: value => `vor ${value} Wo.`,
            month: value => `vor ${value} Mon.`,
            year: value => `vor ${value} J.`
        },
        es: {
            now: 'ahora',
            minute: value => `hace ${value} min`,
            hour: value => `hace ${value} h`,
            day: value => `hace ${value} d`,
            week: value => `hace ${value} sem`,
            month: value => `hace ${value} mes`,
            year: value => `hace ${value} a`
        }
    };
    const dictionary = labels[language] || labels.en;
    return unit === 'now' ? dictionary.now : dictionary[unit](amount);
}

function applyActivity(row, activity) {
    const status = activity?.status || 'unavailable';
    if (status !== 'ok' || !activity?.lastActivityAt) {
        setRowState(row, status);
        return;
    }

    row.dataset.activityState = 'ok';
    row.dataset.activityAt = activity.lastActivityAt;
    row.dataset.activitySource = activity.source || '';
    row.dataset.activityAccount = activity.accountName || '';
    row.dataset.activityTag = activity.accountTag || '';
    row.classList.remove('is-loading', 'is-muted');

    const value = row.querySelector('.groups-member-activity-value');
    if (value) value.textContent = formatLastActivity(activity.lastActivityAt);
    updateActivityTitle(row);
}

function setRowState(row, state) {
    row.dataset.activityState = state;
    delete row.dataset.activityAt;
    delete row.dataset.activitySource;
    delete row.dataset.activityAccount;
    delete row.dataset.activityTag;
    row.removeAttribute('title');
    row.classList.toggle('is-loading', state === 'loading');
    row.classList.toggle('is-muted', state !== 'ok');

    const value = row.querySelector('.groups-member-activity-value');
    if (!value) return;
    const labels = {
        loading: t('groups.activityLoading'),
        no_accounts: t('groups.activityNoAccounts'),
        unmeasured: t('groups.activityNotMeasured'),
        unavailable: t('groups.activityUnavailable')
    };
    value.textContent = labels[state] || labels.unavailable;
}

function updateActivityTitle(row) {
    const sourceKey = SOURCE_KEYS[row.dataset.activitySource] || 'groups.activitySourceDetected';
    const source = t(sourceKey);
    const accountName = row.dataset.activityAccount;
    const accountTag = row.dataset.activityTag;
    const account = [accountName, accountTag].filter(Boolean).join(' · ');
    row.title = account
        ? t('groups.activityTooltipAccount', { source, account })
        : t('groups.activityTooltip', { source });
}

function memberRows(root) {
    return new Map(
        Array.from(root.querySelectorAll('.groups-member-item[data-user-id]'))
            .map(row => [String(row.dataset.userId || ''), row.querySelector('.groups-member-activity')])
            .filter(([userId, row]) => userId && row)
    );
}

function memberAccounts(member) {
    const profile = Array.isArray(member?.profile) ? member.profile[0] : member?.profile;
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

function startRelativeTimeTicker(root) {
    if (relativeTimeTimer) globalThis.clearInterval(relativeTimeTimer);
    relativeTimeTimer = globalThis.setInterval(() => refreshGroupActivityLabels(root), 60 * 1000);
    relativeTimeTimer?.unref?.();
}

window.addEventListener('clashtools:language-changed', () => {
    document.querySelectorAll('.groups-member-activity').forEach(row => {
        if (row.dataset.activityState === 'ok') return;
        setRowState(row, row.dataset.activityState || 'unavailable');
    });
    refreshGroupActivityLabels(document);
});
