import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    normalizePlayerTag,
    sendFriendRequest
} from '../../src/assets/js/profile/profile-page-actions.js';
import { renderAccounts } from '../../src/assets/js/profile/profile-page-view.js';

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
        const bootstrap = readFileSync('src/assets/js/shell/workspace-bootstrap.js', 'utf8');
        expect(shell.match(/href="\/app\/profile"/g)).toHaveLength(2);
        expect(bootstrap).not.toContain('profile_popup');
        expect(bootstrap).not.toContain('preloadProfileMarkup');
    });

    it('renders one accessible Verified status badge per linked account', () => {
        document.body.innerHTML = '<div id="profile-account-list"></div>';
        renderAccounts([{ name: 'Ember Crown', tag: '#2PPQ9L8', townHallLevel: 17 }]);

        const account = document.querySelector('#profile-account-list .profile-list-item');
        expect(account.querySelectorAll('.cp-badge--success')).toHaveLength(1);
        expect(account.textContent.match(/Verified/g)).toHaveLength(1);
    });

    it('keeps profile controls scoped to the responsive contracts', () => {
        const page = readFileSync('src/subpages/profile.html', 'utf8');
        const profileStyles = readFileSync('src/assets/css/pages/profile.css', 'utf8');
        const shellStyles = readFileSync('src/assets/css/shell/workspace-shell.css', 'utf8');
        const components = readFileSync('src/assets/css/system/components.css', 'utf8');

        expect(page).toContain('aria-label="Copy friend code"');
        expect(page).toContain('class="profile-choice-row po-theme-options"');
        expect(profileStyles).toContain('.language-switcher--profile .language-switcher-menu');
        expect(profileStyles).toContain('min-height: 44px');
        expect(shellStyles).toContain('grid-template-columns 240ms var(--cp-ease-emphasized)');
        expect(components).toContain('html[data-theme="light"] .cp-button--primary');
        expect(components).toContain('.cp-button--danger:focus-visible');
    });
});
