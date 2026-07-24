import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    buildGroupPollHref,
    isGroupMemberJoinedNotification,
    isPollNotification,
    pollNotificationCopy,
    readGroupPollTarget,
    stageGroupPollNavigation,
    unreadPollNotificationCount
} from '../../src/assets/js/notifications/poll-notifications.js';

const pollNotification = {
    id: 'notification-1',
    type: 'poll_created',
    title: 'July CWL',
    payload: { pollTitle: 'July CWL' },
    related_group_id: 'group-1',
    related_poll_id: 'poll-1',
    read_at: null
};

const memberJoinedNotification = {
    id: 'notification-joined',
    type: 'group_update',
    title: 'New group member',
    payload: {
        event: 'member_joined',
        memberName: 'Raven',
        groupName: 'Alpha clan'
    },
    related_group_id: 'group-1',
    related_poll_id: null,
    read_at: null
};

describe('poll notifications', () => {
    it('counts unread poll events for the selected group only', () => {
        const items = [
            pollNotification,
            { ...pollNotification, id: 'notification-2', type: 'poll_reminder' },
            { ...pollNotification, id: 'notification-3', related_group_id: 'group-2' },
            { ...pollNotification, id: 'notification-4', read_at: '2026-07-23T10:00:00Z' },
            { ...pollNotification, id: 'notification-5', type: 'group_update' }
        ];

        expect(isPollNotification(pollNotification)).toBe(true);
        expect(unreadPollNotificationCount(items, 'group-1')).toBe(2);
        expect(unreadPollNotificationCount(items, 'group-2')).toBe(1);
    });

    it('builds and stages a direct link to the Availability poll', () => {
        const sessionValues = new Map();
        const localValues = new Map();
        const store = values => ({ setItem: (key, value) => values.set(key, value) });

        expect(stageGroupPollNavigation(pollNotification, store(sessionValues), store(localValues))).toBe(true);
        expect(sessionValues.get('clashtoolsOpenGroupId')).toBe('group-1');
        expect(sessionValues.get('clashtoolsOpenPollId')).toBe('poll-1');
        expect(localValues.get('clashtoolsGroupTab:group-1')).toBe('availability');

        const href = buildGroupPollHref(
            pollNotification,
            'https://clashpanel.example/subpages/dashboard.html'
        );
        expect(href).toBe('https://clashpanel.example/subpages/groups.html?groupId=group-1&pollId=poll-1&tab=availability');
        expect(readGroupPollTarget(href)).toEqual({
            groupId: 'group-1',
            pollId: 'poll-1',
            tab: 'availability'
        });
    });

    it('localizes the event while retaining the poll title', () => {
        const translate = (key, params = {}) => `${key}:${params.title || ''}`;

        expect(pollNotificationCopy(pollNotification, translate)).toEqual({
            title: 'notifications.pollCreatedTitle:',
            body: 'notifications.pollCreatedBody:July CWL'
        });
    });

    it('localizes a member join and links leaders to the group member list', () => {
        const translate = (key, params = {}) => `${key}:${params.name || ''}:${params.group || ''}`;
        const sessionValues = new Map();
        const localValues = new Map();
        const store = values => ({ setItem: (key, value) => values.set(key, value) });

        expect(isGroupMemberJoinedNotification(memberJoinedNotification)).toBe(true);
        expect(pollNotificationCopy(memberJoinedNotification, translate)).toEqual({
            title: 'notifications.memberJoinedTitle::',
            body: 'notifications.memberJoinedBody:Raven:Alpha clan'
        });
        expect(stageGroupPollNavigation(memberJoinedNotification, store(sessionValues), store(localValues))).toBe(true);
        expect(sessionValues.get('clashtoolsOpenGroupId')).toBe('group-1');
        expect(sessionValues.has('clashtoolsOpenPollId')).toBe(false);
        expect(localValues.get('clashtoolsGroupTab:group-1')).toBe('members');

        const href = buildGroupPollHref(
            memberJoinedNotification,
            'https://clashpanel.example/subpages/dashboard.html'
        );
        expect(href).toBe('https://clashpanel.example/subpages/groups.html?groupId=group-1&tab=members');
        expect(readGroupPollTarget(href)).toEqual({
            groupId: 'group-1',
            pollId: '',
            tab: 'members'
        });
    });
});

describe('poll notification migration', () => {
    const migration = readFileSync(
        'database/migrations/20260723112630_notify_all_members_about_poll_events.sql',
        'utf8'
    );
    const javaHandler = readFileSync('src/Java/SUPABASE_GroupPolls.java', 'utf8');

    it('creates the poll and every member notification in one service-only RPC', () => {
        expect(migration).toContain('create_group_poll_with_notifications');
        expect(migration).toContain("'poll_created'");
        expect(migration.match(/select p_actor_user_id/g)).toHaveLength(2);
        expect(migration).toContain('set search_path = \'\'');
        expect(migration).toContain('to service_role');
        expect(javaHandler).toContain('SUPABASE_Client.rpc("create_group_poll_with_notifications"');
    });

    it('reminds answered members and the sender while retaining duplicate protection', () => {
        const reminder = migration.slice(migration.indexOf('create or replace function public.send_group_poll_reminders'));

        expect(reminder).not.toContain('member.user_id <> p_actor_user_id');
        expect(reminder).toContain('answered_count := answered_count + 1;');
        expect(reminder).toContain("delivery.sent_at >= now() - interval '6 hours'");
        expect(reminder.indexOf('answered_count := answered_count + 1;'))
            .toBeLessThan(reminder.indexOf('insert into public.notifications'));
    });
});
