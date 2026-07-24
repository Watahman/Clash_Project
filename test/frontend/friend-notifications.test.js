import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
    isFriendNotification,
    isFriendRequestNotification,
    pollNotificationCopy
} from '../../src/assets/js/notifications/poll-notifications.js';
import { hideProfileEmptyStateFor } from '../../src/assets/js/profile/profile_empty_state.js';

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

    it('keeps the request count as a separate element so translations cannot remove it', () => {
        const markup = readFileSync('src/subpages/popup_htmls/profile_popup.html', 'utf8');
        document.body.innerHTML = markup;

        const button = document.querySelector('#po-friend-requests-btn');
        expect(button.querySelector('[data-i18n="profile.requests"]')).not.toBeNull();
        expect(button.querySelector('#po-friend-requests-count')).not.toBeNull();
        expect(button.hasAttribute('data-i18n')).toBe(false);
    });
});

describe('profile empty state', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('hides the empty state immediately after the first item is added to the active tab', () => {
        document.body.innerHTML = `
            <button id="po-tab-bases" class="po-tab po-tab-active"></button>
            <div class="po-panel-content"><p class="po-empty">No bases</p></div>
        `;

        expect(hideProfileEmptyStateFor('po-tab-bases')).toBe(true);
        expect(document.querySelector('.po-empty').classList.contains('hidden')).toBe(true);
    });

    it('does not hide another tab its empty state', () => {
        document.body.innerHTML = `
            <button id="po-tab-bases" class="po-tab po-tab-active"></button>
            <div class="po-panel-content"><p class="po-empty">No bases</p></div>
        `;

        expect(hideProfileEmptyStateFor('po-tab-friends')).toBe(false);
        expect(document.querySelector('.po-empty').classList.contains('hidden')).toBe(false);
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
