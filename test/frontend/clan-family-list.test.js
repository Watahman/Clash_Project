import { describe, expect, it, vi } from 'vitest';
import { createClanFamilyListController } from '../../src/assets/js/groups/clan-family-list.js';
import { buildClanFamilyFixture } from '../../src/assets/js/groups/clan-family-fixtures.js';

describe('Clan Family list controller', () => {
    it('renders fixture entries through the same list seam without fetching production memberships', async () => {
        const fixture = buildClanFamilyFixture('family-admin');
        const list = document.createElement('div');
        const count = document.createElement('span');
        const refs = { list, listCount: count };
        const state = { fixture: null, userId: '', reload: 0 };
        const fetchGroups = vi.fn();
        const createCards = vi.fn().mockResolvedValue(true);
        const resetGroupDetail = vi.fn();
        const controller = createClanFamilyListController({
            refs,
            state,
            resetGroupDetail,
            emptyMessage: message => Object.assign(document.createElement('p'), { textContent: message }),
            getFixture: vi.fn().mockResolvedValue(fixture),
            fetchGroups,
            createCards
        });

        await controller.reload();

        expect(fetchGroups).not.toHaveBeenCalled();
        expect(state.fixture).toBe(fixture);
        expect(count.textContent).toBe('1');
        expect(createCards).toHaveBeenCalledWith(
            [fixture.entries[0].membership],
            expect.objectContaining({ entries: fixture.entries, fixture })
        );
    });
});
