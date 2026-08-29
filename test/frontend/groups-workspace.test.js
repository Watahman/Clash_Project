import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupMemberSummary, memberAccounts } from '../../src/assets/js/templates/GroupTemplates.js?v=20260829-public-auth-v1';
import { canKickGroupMember, canManageGroupMembers, canManageGroupRoles, isGroupAdmin } from '../../src/assets/js/groups/groups-roles.js';
import { activateGroupTab, bindGroupTabs, normalizeGroupTab } from '../../src/assets/js/groups/groups-tabs.js';
import { renderBadge } from '../../src/assets/js/groups/groups-badges.js';
import { createMemberRoleAdmin } from '../../src/assets/js/groups/groups-admin-members.js?v=20260829-public-auth-v1';
import { initGroupIndexSlider } from '../../src/assets/js/groups/groups-index-slider.js?v=20260829-public-auth-v1';

describe('Clan Family workspace', () => {
    it('keeps the approved five-section information architecture and owned controls', () => {
        const html = readFileSync('src/subpages/groups.html', 'utf8');
        const tabs = [...html.matchAll(/data-group-tab="([^"]+)"/g)].map(match => match[1]);

        expect(tabs).toEqual(['overview', 'members', 'clans', 'polls', 'settings']);
        expect(html).not.toContain('data-admin-tab="future"');
        expect(html).not.toContain('groups-invite-btn');
        expect(html).toContain('id="groups-poll-reminder-btn"');
        expect(html).toContain('id="groups-admin-scan-unlinked"');
        expect(html).toContain('id="groups-index-toggle"');
        expect(html).toContain('data-i18n="groups.clansSharedHelp"');
        expect(html).toContain('data-family-copy="readiness"');
        expect(html).toContain('id="groups-member-drawer"');
        expect(html).toContain('groups-admin-only hidden" data-role-visible="leader,co_leader"');
        expect(html).not.toContain('data-group-tab="availability"');
        expect(html).not.toContain('groups-badge-picker');
        expect(html).not.toContain('groups-badge-options');
    });

    it('slides the Clan Family index closed, persists the choice and binds once', () => {
        localStorage.clear();
        document.body.innerHTML = `
            <div class="groups-workspace">
                <aside id="groups-sidebar"></aside>
                <button id="groups-index-toggle" type="button" aria-expanded="true"></button>
            </div>`;
        const workspace = document.querySelector('.groups-workspace');
        const toggle = document.querySelector('#groups-index-toggle');

        expect(initGroupIndexSlider(workspace, toggle)).toBe(true);
        expect(initGroupIndexSlider(workspace, toggle)).toBe(false);
        toggle.click();

        expect(workspace.classList.contains('is-group-index-collapsed')).toBe(true);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.getAttribute('aria-label')).toBe('Expand Clan Families');
        expect(localStorage.getItem('clashtools_groups_index_collapsed')).toBe('true');

        toggle.click();
        expect(workspace.classList.contains('is-group-index-collapsed')).toBe(false);
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.getAttribute('aria-label')).toBe('Collapse Clan Families');
    });


    it('uses the Clash default banner until a main clan provides an official badge', () => {
        document.body.innerHTML = '<div id="group-badge"></div>';
        const badge = document.querySelector('#group-badge');

        renderBadge(badge, 'shield', '');
        expect(badge.dataset.badge).toBe('default');
        expect(badge.querySelector('img')?.src).toContain('/assets/placeholders/clan-badge.svg');

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

    it('enforces the leader and co-leader kick hierarchy', () => {
        expect(canKickGroupMember('leader', 'co_leader')).toBe(true);
        expect(canKickGroupMember('leader', 'member')).toBe(true);
        expect(canKickGroupMember('leader', 'leader')).toBe(false);
        expect(canKickGroupMember('co_leader', 'member')).toBe(true);
        expect(canKickGroupMember('co_leader', 'co_leader')).toBe(false);
        expect(canKickGroupMember('co_leader', 'leader')).toBe(false);
        expect(canKickGroupMember('member', 'member')).toBe(false);
        expect(canManageGroupMembers('co_leader', 'member')).toBe(true);
        expect(canManageGroupRoles('leader', 'co_leader')).toBe(true);
        expect(canManageGroupRoles('co_leader', 'member')).toBe(false);
    });

    it('never exposes internal member UUIDs as display names or codes', () => {
        const adminSource = readFileSync('src/assets/js/groups/groups-admin-members.js', 'utf8');
        const memberSource = readFileSync('src/assets/js/templates/GroupTemplates.js', 'utf8');
        const pollSource = readFileSync('src/assets/js/groups/groups-polls.js', 'utf8');

        expect(adminSource).not.toContain("textNode('span', member.user_id)");
        expect(adminSource).not.toContain('user?.name || member.user_id');
        expect(memberSource).not.toContain('name: member.user_id');
        expect(memberSource).not.toContain('user.code || member.user_id');
        expect(pollSource).not.toContain('profile?.name || member.name || member.user_id');
    });

    it('shows the public user ID beside the member name in role cards', async () => {
        document.body.innerHTML = '<div id="members"></div>';
        const uuid = '2094a3a0-ff61-45f0-9ea8-ef7bc1c40ace';
        const admin = createMemberRoleAdmin(
            { members: document.querySelector('#members') },
            () => ({
                currentRole: 'member',
                members: [{ user_id: uuid, role: 'member', profile: { id: uuid, name: 'Emile', code: 'CP1234' } }]
            }),
            () => {},
            message => document.createTextNode(message),
            async () => {}
        );

        await admin.render();

        expect(document.querySelector('.groups-admin-member-heading strong')?.textContent).toBe('Emile');
        expect(document.querySelector('.groups-admin-member-code')?.textContent).toBe('#CP1234');
        expect(document.querySelector('.groups-admin-member-avatar')?.textContent).toBe('E');
        expect(document.querySelector('.groups-admin-member')?.textContent).not.toContain(uuid);
    });

    it('normalizes legacy availability links into Polls', () => {
        expect(normalizeGroupTab('availability')).toBe('polls');
        expect(normalizeGroupTab('settings')).toBe('settings');
        expect(normalizeGroupTab('future')).toBe('overview');
    });

    it('keeps the responsive and reduced-motion contracts in the module stylesheet', () => {
        const css = readFileSync('src/assets/css/pages/clan-family.css', 'utf8');
        const content = readFileSync('src/assets/css/pages/clan-family-content.css', 'utf8');
        const overlays = readFileSync('src/assets/css/pages/clan-family-overlays.css', 'utf8');

        expect(content).toContain('@media (max-width: 720px)');
        expect(content).toContain('min-height: 70px');
        expect(content).toContain('.groups-member-item');
        expect(content).toContain('.cf-poll-matrix-row');
        expect(content).toContain('.cf-settings-section');
        expect(content).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).not.toContain('.cf-poll-matrix-row');
        expect(overlays).toContain('min-height: 44px');
        expect(overlays).toContain('@media (max-width: 600px)');
    });

    it('keeps extracted controllers and stylesheets below the follow-up review ceiling', () => {
        const sources = [
            'src/assets/js/pages/groups.js',
            'src/assets/js/groups/groups-polls.js',
            'src/assets/js/groups/groups-polls-actions.js',
            'src/assets/js/groups/groups-polls-render.js',
            'src/assets/js/groups/groups-polls-state.js',
            'src/assets/js/groups/clan-family-actions.js',
            'src/assets/js/groups/clan-family-list.js',
            'src/assets/css/pages/clan-family.css',
            'src/assets/css/pages/clan-family-content.css'
        ];
        sources.forEach(path => expect(readFileSync(path, 'utf8').split(/\r?\n/).length).toBeLessThanOrEqual(300));

        const html = readFileSync('src/subpages/groups.html', 'utf8');
        expect(html.indexOf('pages/clan-family.css')).toBeLessThan(html.indexOf('pages/clan-family-content.css'));
        expect(html.indexOf('pages/clan-family-content.css')).toBeLessThan(html.indexOf('pages/clan-family-overlays.css'));
    });

    it('keeps UI permission hints advisory while writes stay on authoritative seams', () => {
        const lifecycle = readFileSync('src/assets/js/groups/clan-family-actions.js', 'utf8');
        const pollActions = readFileSync('src/assets/js/groups/groups-polls-actions.js', 'utf8');
        const pollBackend = readFileSync('src/Java/SUPABASE_GroupPolls.java', 'utf8');

        expect(lifecycle).toContain('api.createGroup');
        expect(lifecycle).toContain('api.joinGroup');
        expect(lifecycle).toContain('api.leaveGroup');
        expect(pollActions).toContain('isGroupAdmin');
        expect(pollActions).toContain('createGroupPoll');
        expect(pollActions).toContain('state.entry?.fixture');
        expect(pollBackend).toContain('access.requireAdmin(groupId, actorId)');
    });

    it('binds tab navigation once and switches panels without loading data', () => {
        document.body.innerHTML = `<nav class="groups-detail-tabs">
            <button data-group-tab="overview"><span>Overview</span></button>
            <button data-group-tab="members"><span>Leden</span></button>
            <button data-group-tab="clans"><span>Clans</span></button>
            <button data-group-tab="polls"><span>Polls</span></button>
            <button data-group-tab="settings"><span>Settings</span></button>
        </nav>
        <div data-group-panel="overview"></div><div data-group-panel="members"></div>
        <div data-group-panel="clans"></div><div data-group-panel="polls"></div>
        <div data-group-panel="settings"></div>`;
        let switches = 0;
        const onSelect = tab => { switches += 1; activateGroupTab(document, tab); };

        expect(bindGroupTabs(document, onSelect)).toBe(true);
        expect(bindGroupTabs(document, onSelect)).toBe(false);
        document.querySelector('[data-group-tab="polls"] span').click();

        expect(switches).toBe(1);
        expect(document.querySelector('.groups-detail-tabs .is-active').dataset.groupTab).toBe('polls');
        expect(document.querySelector('[data-group-panel="polls"]').classList.contains('is-visible')).toBe(true);
        expect(document.querySelector('[data-group-panel="overview"]').hidden).toBe(true);
    });
});

describe('Group membership transactions', () => {
    const migration = readFileSync(
        'database/migrations/20260723122121_group_membership_notifications_and_shared_clans.sql',
        'utf8'
    );
    const javaHandler = readFileSync('src/Java/SUPABASE_Group.java', 'utf8');

    it('joins atomically and notifies every leader with the member name', () => {
        expect(migration).toContain('join_group_with_notifications');
        expect(migration).toContain("member.role in ('leader', 'co_leader')");
        expect(migration).toContain("'memberName', member_name");
        expect(migration).toContain("'group_update'");
        expect(migration).toContain('on conflict (group_id, user_id) do nothing');
        expect(javaHandler).toContain('SUPABASE_Client.rpc("join_group_with_notifications"');
    });

    it('stores clans per group and protects the kick hierarchy in the database', () => {
        expect(migration).toContain('group_clans_member_read');
        expect(migration).toContain('public.is_group_member(group_id)');
        expect(migration).toContain('public.can_manage_group(group_id)');
        expect(migration).toContain('kick_group_member');
        expect(migration).toContain("actor_role = 'leader' and target_role in ('co_leader', 'member')");
        expect(migration).toContain("actor_role = 'co_leader' and target_role = 'member'");
        expect(javaHandler).toContain('SUPABASE_Client.rpc("kick_group_member"');
    });
});
