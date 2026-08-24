import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    isFriendNotification,
    isFriendRequestNotification,
    pollNotificationCopy
} from '../../src/assets/js/notifications/poll-notifications.js';

describe('friend notifications', () => {
    const request = {
        type: 'friend_request',
        payload: {
            actorId: 'user-1',
            actorName: 'Raven'
        }
    };

    it('localizes request and acceptance notifications with the actor name', () => {
        const translate = (key, params = {}) => `${key}:${params.name || ''}`;

        expect(isFriendNotification(request)).toBe(true);
        expect(isFriendRequestNotification(request)).toBe(true);
        expect(pollNotificationCopy(request, translate)).toEqual({
            title: 'notifications.friendRequestTitle:',
            body: 'notifications.friendRequestBody:Raven'
        });
        expect(pollNotificationCopy({
            ...request,
            type: 'friend_accepted'
        }, translate)).toEqual({
            title: 'notifications.friendAcceptedTitle:',
            body: 'notifications.friendAcceptedBody:Raven'
        });
    });

});

describe('friend notification migration', () => {
    const migration = readFileSync(
        'database/migrations/20260723144101_friend_request_notifications.sql',
        'utf8'
    );

    it('creates request and acceptance notifications in the friendship transaction', () => {
        expect(migration).toContain("'friend_request'");
        expect(migration).toContain("'friend_accepted'");
        expect(migration).toContain("tg_op = 'INSERT'");
        expect(migration).toContain("old.status = 'pending'");
        expect(migration).toContain("new.status = 'accepted'");
        expect(migration).toContain('after insert or update of status on public.friends');
        expect(migration).toContain("set search_path = ''");
        expect(migration).toContain('revoke all on function public.notify_friendship_change()');
    });
});
