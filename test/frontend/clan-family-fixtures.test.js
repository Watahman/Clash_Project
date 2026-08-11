import { describe, expect, it } from 'vitest';
import { buildClanFamilyFixture } from '../../src/assets/js/groups/clan-family-fixtures.js';

describe('Clan Family redesign fixtures', () => {
    it('covers the requested dev-only states without changing production data seams', () => {
        const ids = ['family-empty', 'family-member', 'family-admin', 'family-active-poll', 'family-poll-partial', 'family-audit-issues', 'family-large'];
        ids.forEach(id => {
            const fixture = buildClanFamilyFixture(id);
            expect(fixture.fixture).toBe(true);
            expect(fixture.fixtureId).toBe(id);
            expect(fixture.entries).toBeInstanceOf(Array);
        });

        expect(buildClanFamilyFixture('family-empty').entries).toHaveLength(0);
        expect(buildClanFamilyFixture('family-member').currentUserId).toBe('fixture-member');
        expect(buildClanFamilyFixture('family-active-poll').entries[0].polls[0].status).toBe('open');
        expect(buildClanFamilyFixture('family-poll-partial').entries[0].polls[0].answers).toBeTruthy();
        expect(buildClanFamilyFixture('family-audit-issues').entries[0].auditIssues).toHaveLength(2);
        expect(buildClanFamilyFixture('family-large').entries[0].members).toHaveLength(64);
        expect(buildClanFamilyFixture('family-large').entries[0].clans).toHaveLength(6);
    });
});
