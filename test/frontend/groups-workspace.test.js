import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupMemberSummary, memberAccounts } from '../../src/assets/js/templates/GroupTemplates.js';
import { isGroupAdmin } from '../../src/assets/js/groups/groups-roles.js';
import { activateGroupTab, bindGroupTabs } from '../../src/assets/js/groups/groups-tabs.js';
import { renderBadge } from '../../src/assets/js/groups/groups-badges.js';

describe('Groups V1 workspace', () => {
    it('keeps the approved four real tabs and removes dead or broken controls', () => {
        const html = readFileSync('src/subPages/groups.html', 'utf8');
        const tabs = [...html.matchAll(/data-group-tab="([^"]+)"/g)].map(match => match[1]);

        expect(tabs).toEqual(['members', 'availability', 'polls', 'clans']);
        expect(html).not.toContain('data-admin-tab="future"');
        expect(html).not.toContain('groups-invite-btn');
        expect(html).toContain('id="groups-settings-btn"');
        expect(html).toContain('id="groups-poll-reminder-btn"');
        expect(html).toContain('id="groups-admin-scan-unlinked"');
        expect(html).not.toContain('groups-badge-picker');
        expect(html).not.toContain('groups-badge-options');
    });


    it('uses the Clash default banner until a main clan provides an official badge', () => {
        document.body.innerHTML = '<div id="group-badge"></div>';
        const badge = document.querySelector('#group-badge');

        renderBadge(badge, 'shield', '');
        expect(badge.dataset.badge).toBe('default');
        expect(badge.querySelector('img')?.src).toContain('default-clan-banner.png');

        renderBadge(badge, 'shield', 'https://example.com/clan-badge.png');
        expect(badge.dataset.badge).toBe('official');
        expect(badge.querySelector('img')?.src).toBe('https://example.com/clan-badge.png');
    });

    it('counts every linked account regardless of stored account shape', () => {
        const members = [
            { role: 'leader', profile: { accounts: [{ tag: '#ONE' }, { tag: '#TWO' }] } },
            { role: 'co_leader', profile: { accounts: JSON.stringify([{ tag: '#THREE' }]) } },
            { role: 'member', profile: { accounts: 'invalid json' } }
        ];

        expect(memberAccounts(members[1])).toHaveLength(1);
        expect(groupMemberSummary(members)).toEqual({ members: 3, accounts: 3, leaders: 2 });
    });

    it('exposes management only to actual leaders and co-leaders', () => {
        expect(isGroupAdmin('leader')).toBe(true);
        expect(isGroupAdmin('co_leader')).toBe(true);
        expect(isGroupAdmin('member')).toBe(false);
        expect(isGroupAdmin('unexpected-role')).toBe(false);
    });

    it('binds tab navigation once and switches panels without loading data', () => {
        document.body.innerHTML = `<nav class="groups-detail-tabs">
            <button data-group-tab="members"><span>Leden</span></button>
            <button data-group-tab="availability"><span>Beschikbaarheid</span></button>
            <button data-group-tab="polls"><span>Polls</span></button>
            <button data-group-tab="clans"><span>Clans</span></button>
        </nav>
        <div data-group-panel="members"></div><div data-group-panel="availability"></div>
        <div data-group-panel="polls"></div><div data-group-panel="clans"></div>`;
        let switches = 0;
        const onSelect = tab => { switches += 1; activateGroupTab(document, tab); };

        expect(bindGroupTabs(document, onSelect)).toBe(true);
        expect(bindGroupTabs(document, onSelect)).toBe(false);
        document.querySelector('[data-group-tab="polls"] span').click();

        expect(switches).toBe(1);
        expect(document.querySelector('.groups-detail-tabs .is-active').dataset.groupTab).toBe('polls');
        expect(document.querySelector('.groups-tab-panel.is-visible')).toBeNull();
        expect(document.querySelector('[data-group-panel="polls"]').classList.contains('is-visible')).toBe(true);
    });
});
