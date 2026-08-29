import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getGroupsOfUser: vi.fn(),
    getGroupClans: vi.fn()
}));

vi.mock('../../src/assets/js/Supabase/Supabase-Group.js?v=20260829-public-auth-v1', () => ({
    getGroupsOfUser: mocks.getGroupsOfUser,
    getGroupClans: mocks.getGroupClans
}));

import {
    createWarSourceGuard,
    getWarSourceUserId,
    loadLinkedWarClans
} from '../../src/assets/js/war-operation-board/war-clan-source.js?v=20260829-public-auth-v1';

describe('War Board linked clan source', () => {
    beforeEach(() => {
        mocks.getGroupsOfUser.mockReset();
        mocks.getGroupClans.mockReset();
    });

    it('requires the authenticated session user id for linked clans', async () => {
        expect(getWarSourceUserId({ status: 'guest' })).toBe('');
        expect(getWarSourceUserId({ status: 'authenticated' })).toBe('');
        expect(await loadLinkedWarClans({
            authState: { status: 'guest' }
        })).toEqual([]);
        expect(mocks.getGroupsOfUser).not.toHaveBeenCalled();
    });

    it('deduplicates and normalizes linked clans for the session owner', async () => {
        mocks.getGroupsOfUser.mockResolvedValue([
            { id: 'group-a' },
            { id: 'group-b' }
        ]);
        mocks.getGroupClans
            .mockResolvedValueOnce([
                { tag: ' #AAA ', name: 'Alpha' },
                { clanTag: '#BBB', clanName: 'Bravo' }
            ])
            .mockResolvedValueOnce([
                { clan_tag: '#AAA', clan_name: 'Duplicate name' }
            ]);

        await expect(loadLinkedWarClans({
            authState: {
                status: 'authenticated',
                session: { user: { id: 'user-a' } }
            }
        })).resolves.toEqual([
            { tag: '#BBB', name: 'Bravo' },
            { tag: '#AAA', name: 'Duplicate name' }
        ]);
        expect(mocks.getGroupsOfUser).toHaveBeenCalledWith('user-a');
    });

    it('invalidates stale linked-source responses across user transitions', () => {
        const guard = createWarSourceGuard();
        const userA = { status: 'authenticated', session: { user: { id: 'user-a' } } };
        const userB = { status: 'authenticated', session: { user: { id: 'user-b' } } };
        guard.transition(userA);
        const request = guard.begin(userA);

        expect(guard.transition(userB).changed).toBe(true);
        expect(guard.isCurrent(request, userB)).toBe(false);
        expect(guard.transition({ status: 'guest' }).changed).toBe(true);
        expect(guard.isCurrent(request, { status: 'guest' })).toBe(false);
    });
});
