export const OPEN_GROUP_STORAGE_KEY = 'clashtoolsOpenGroupId';
export const OPEN_POLL_STORAGE_KEY = 'clashtoolsOpenPollId';
export const GROUP_TAB_STORAGE_PREFIX = 'clashtoolsGroupTab:';

const POLL_NOTIFICATION_TYPES = new Set(['poll_created', 'poll_reminder']);
const FRIEND_NOTIFICATION_TYPES = new Set(['friend_request', 'friend_accepted']);

export function isPollNotification(notification) {
    return POLL_NOTIFICATION_TYPES.has(notification?.type)
        && Boolean(notification?.related_group_id)
        && Boolean(notification?.related_poll_id);
}

export function isGroupMemberJoinedNotification(notification) {
    return notification?.type === 'group_update'
        && notification?.payload?.event === 'member_joined'
        && Boolean(notification?.related_group_id);
}

export function isFriendNotification(notification) {
    return FRIEND_NOTIFICATION_TYPES.has(notification?.type)
        && Boolean(notification?.payload?.actorId);
}

export function isFriendRequestNotification(notification) {
    return notification?.type === 'friend_request'
        && isFriendNotification(notification);
}

export function unreadPollNotificationCount(items, groupId = '') {
    return (Array.isArray(items) ? items : []).filter(notification => {
        if (notification?.read_at || !isPollNotification(notification)) return false;
        return !groupId || notification.related_group_id === groupId;
    }).length;
}

export function pollNotificationCopy(notification, translate) {
    if (isFriendNotification(notification)) {
        const request = notification.type === 'friend_request';
        return {
            title: translate(request
                ? 'notifications.friendRequestTitle'
                : 'notifications.friendAcceptedTitle'),
            body: translate(request
                ? 'notifications.friendRequestBody'
                : 'notifications.friendAcceptedBody', {
                name: notification?.payload?.actorName || ''
            })
        };
    }

    if (isGroupMemberJoinedNotification(notification)) {
        return {
            title: translate('notifications.memberJoinedTitle'),
            body: translate('notifications.memberJoinedBody', {
                name: notification?.payload?.memberName || '',
                group: notification?.payload?.groupName || ''
            })
        };
    }

    if (!isPollNotification(notification)) {
        return {
            title: notification?.title || translate('notifications.title'),
            body: notification?.body || ''
        };
    }

    const pollTitle = notification?.payload?.pollTitle || notification?.title || '';
    const created = notification.type === 'poll_created';
    return {
        title: translate(created ? 'notifications.pollCreatedTitle' : 'notifications.pollReminderTitle'),
        body: translate(
            created ? 'notifications.pollCreatedBody' : 'notifications.pollReminderBody',
            { title: pollTitle }
        )
    };
}

export function buildGroupPollHref(notification, currentHref) {
    const pollNotification = isPollNotification(notification);
    const groupJoinNotification = isGroupMemberJoinedNotification(notification);
    if (!pollNotification && !groupJoinNotification) return '';
    const currentUrl = new URL(currentHref);
    const groupsPath = currentUrl.pathname.includes('/subPages/')
        ? './groups.html'
        : './subPages/groups.html';
    const destination = new URL(groupsPath, currentUrl);
    destination.searchParams.set('groupId', notification.related_group_id);
    if (pollNotification) destination.searchParams.set('pollId', notification.related_poll_id);
    destination.searchParams.set('tab', pollNotification ? 'availability' : 'members');
    return destination.href;
}

export function stageGroupPollNavigation(notification, sessionStore, localStore) {
    const pollNotification = isPollNotification(notification);
    const groupJoinNotification = isGroupMemberJoinedNotification(notification);
    if (!pollNotification && !groupJoinNotification) return false;
    sessionStore?.setItem(OPEN_GROUP_STORAGE_KEY, notification.related_group_id);
    if (pollNotification) sessionStore?.setItem(OPEN_POLL_STORAGE_KEY, notification.related_poll_id);
    localStore?.setItem(
        `${GROUP_TAB_STORAGE_PREFIX}${notification.related_group_id}`,
        pollNotification ? 'availability' : 'members'
    );
    return true;
}

export function readGroupPollTarget(currentHref) {
    const params = new URL(currentHref).searchParams;
    return {
        groupId: params.get('groupId') || '',
        pollId: params.get('pollId') || '',
        tab: ['availability', 'members'].includes(params.get('tab')) ? params.get('tab') : ''
    };
}
