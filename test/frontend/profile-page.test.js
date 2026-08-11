import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    normalizePlayerTag,
    sendFriendRequest
} from '../../src/assets/js/profile/profile-page-actions.js';

describe('dedicated profile page', () => {
    it('normalizes player tags from text and share links', () => {
        expect(normalizePlayerTag('2ppq9lo')).toBe('#2PPQ9L0');
        expect(normalizePlayerTag('https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=%232PPQ9L8'))
            .toBe('#2PPQ9L8');
    });

    it('keeps account, friends and settings on a real workspace route', () => {
        const page = readFileSync('src/subpages/profile.html', 'utf8');
        expect(page).toContain('data-profile-panel="accounts"');
        expect(page).toContain('data-profile-panel="friends"');
        expect(page).toContain('data-profile-panel="settings"');
        expect(page).toContain('id="account-dialog"');
        expect(page).toContain('id="friend-dialog"');
    });

    it('refuses a request to the profile owner in fixture-safe mode', async () => {
        await expect(sendFriendRequest({ code: '#ABC12', ownCode: 'ABC12', fixture: true }))
            .rejects.toThrow();
    });

    it('links the shared avatar controls to the dedicated profile page', () => {
        const shell = readFileSync('src/assets/js/shell/workspace-shell-markup.js', 'utf8');
        expect(shell.match(/href="\/app\/profile"/g)).toHaveLength(2);
    });
});
