import { getRedesignFixture, isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';

const FAMILY_SCENARIOS = new Set([
    'family-empty', 'family-member', 'family-admin', 'family-active-poll',
    'family-poll-partial', 'family-audit-issues', 'family-large'
]);

export async function loadClanFamilyFixture(location = window.location) {
    if (!isRedesignFixtureRequested(location)) return null;
    const fixture = await getRedesignFixture(location);
    if (fixture?.module !== 'clan-family' || !FAMILY_SCENARIOS.has(fixture.id)) return null;
    return buildClanFamilyFixture(fixture.id);
}

export function buildClanFamilyFixture(id) {
    if (id === 'family-empty') return { fixture: true, fixtureId: id, currentUserId: 'fixture-member', entries: [] };

    const isAdmin = id !== 'family-member';
    const currentUserId = isAdmin ? 'fixture-leader' : 'fixture-member';
    const members = buildMembers(id);
    const group = {
        id: `fixture-${id}`,
        name: id === 'family-large' ? 'Northwind Network' : 'Northwind Family',
        code: id === 'family-large' ? 'NW-884211' : 'NW-240817',
        owner_id: 'fixture-leader',
        created_at: '2025-04-18T12:00:00Z',
        badge: 'shield',
        badge_url: '/assets/fixtures/clan-badges/northwind-main.png'
    };
    const entry = {
        membership: { group_id: group.id, role: isAdmin ? 'leader' : 'member' },
        group,
        members,
        clans: buildClans(id),
        polls: buildPolls(id, members),
        auditIssues: id === 'family-audit-issues' ? buildAuditIssues() : [],
        auditState: id === 'family-audit-issues' ? 'issues' : 'not-run',
        fixture: true
    };
    return { fixture: true, fixtureId: id, currentUserId, entries: [entry] };
}

function buildMembers(id) {
    if (id === 'family-large') {
        return Array.from({ length: 64 }, (_, index) => {
            const role = index === 0 ? 'leader' : index < 4 ? 'co_leader' : 'member';
            return member(`large-${index}`, `Northwind ${String(index + 1).padStart(2, '0')}`, role, index % 4 === 0);
        });
    }
    return [
        member('fixture-leader', 'Mira North', 'leader', true),
        member('fixture-co-leader', 'Jon Vale', 'co_leader', true),
        member('fixture-member', 'Emile Stone', 'member', true),
        member('fixture-member-2', 'Rae Willow', 'member', false),
        member('fixture-member-3', 'Kai Reed', 'member', true)
    ];
}

function member(id, name, role, linked) {
    return {
        user_id: id,
        role,
        joined_at: '2025-05-02T09:00:00Z',
        profile: {
            id,
            name,
            code: id === 'fixture-leader' ? 'MIRA24' : id === 'fixture-member' ? 'STONE7' : id.slice(-6).toUpperCase(),
            accounts: linked ? [{ name: `${name.split(' ')[0]} Main`, tag: `#${id.replace(/[^A-Z0-9]/gi, '').slice(0, 7).toUpperCase() || 'FIXTURE1'}`, townHallLevel: 17 }] : []
        },
        activity: linked ? '2h ago' : ''
    };
}

function buildClans(id) {
    if (id === 'family-large') {
        return Array.from({ length: 6 }, (_, index) => ({
            clan_tag: `#NW${String(index + 1).padStart(3, '0')}CLAN`,
            clan_name: ['Northwind Main', 'Northwind Academy', 'Northwind Forge', 'Northwind Tide', 'Northwind Vale', 'Northwind Reserve'][index],
            badge_url: index % 2 === 0
                ? '/assets/fixtures/clan-badges/northwind-main.png'
                : '/assets/fixtures/clan-badges/northwind-academy.png',
            is_primary: index === 0,
            member_count: 38 - index * 3
        }));
    }
    if (id === 'family-member') return [{ clan_tag: '#NORTH01', clan_name: 'Northwind Main', badge_url: '/assets/fixtures/clan-badges/northwind-main.png', is_primary: true, member_count: 28 }];
    return [
        { clan_tag: '#NORTH01', clan_name: 'Northwind Main', badge_url: '/assets/fixtures/clan-badges/northwind-main.png', is_primary: true, member_count: 28 },
        { clan_tag: '#NORTH02', clan_name: 'Northwind Academy', badge_url: '/assets/fixtures/clan-badges/northwind-academy.png', is_primary: false, member_count: 19 }
    ];
}

function buildPolls(id, members) {
    if (id === 'family-admin') return [];
    if (id === 'family-active-poll') return [poll('August CWL availability', 'open', members, 25)];
    if (id === 'family-poll-partial') return [poll('September CWL availability', 'open', members, 3)];
    if (id === 'family-large') return [poll('October CWL availability', 'open', members, 48), poll('July CWL availability', 'closed', members, 64)];
    return [poll('July CWL availability', 'closed', members, members.length)];
}

function poll(title, status, members, answerCount) {
    const answers = {};
    members.slice(0, answerCount).forEach(memberItem => {
        answers[memberItem.user_id] = { accounts: memberItem.profile.accounts.map(account => ({ ...account, wantsCwl: true, days: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true } })) };
    });
    return { id: `poll-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`, title, type: 'cwl_availability', status, rounds: 7, created_at: '2026-08-01T12:00:00Z', answers, members };
}

function buildAuditIssues() {
    return [
        { name: 'Unlinked Rider', tag: '#AUDIT01', townHall: 17, clan: 'Northwind Main' },
        { name: 'Missing Sage', tag: '#AUDIT02', townHall: 16, clan: 'Northwind Academy' }
    ];
}
