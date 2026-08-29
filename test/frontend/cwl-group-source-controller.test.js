import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getGroupClans: vi.fn(),
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn(),
    getGroupsOfUser: vi.fn(),
    getGroupPolls: vi.fn(),
    getUserBases: vi.fn(),
    getCurrentUserId: vi.fn()
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Group.js?v=20260829-public-auth-v1', () => ({
    getGroupClans: mocks.getGroupClans,
    getGroupInfo: mocks.getGroupInfo,
    getGroupMembers: mocks.getGroupMembers,
    getGroupsOfUser: mocks.getGroupsOfUser
}));
vi.mock('../../src/assets/js/Supabase/Supabase-GroupPolls.js?v=20260829-public-auth-v1', () => ({
    getGroupPolls: mocks.getGroupPolls
}));
vi.mock('../../src/assets/js/Supabase/Supabase-User.js?v=20260829-public-auth-v1', () => ({
    getUserBases: mocks.getUserBases
}));
vi.mock('../../src/assets/js/utils/user.js', () => ({
    getCurrentUserId: mocks.getCurrentUserId
}));

const authenticated = userId => ({
    status: 'authenticated',
    session: { user: { id: userId } }
});

function deferred() {
    let resolve;
    const promise = new Promise(result => { resolve = result; });
    return { promise, resolve };
}

describe('CWL group source controller', () => {
    beforeEach(() => {
        vi.resetModules();
        Object.values(mocks).forEach(mock => mock.mockReset());
        mocks.getCurrentUserId.mockReturnValue('fallback-user');
        mocks.getGroupsOfUser.mockResolvedValue([]);
        mocks.getGroupInfo.mockResolvedValue([]);
        mocks.getGroupPolls.mockResolvedValue([]);
        mocks.getGroupMembers.mockResolvedValue([]);
        mocks.getGroupClans.mockResolvedValue([]);
        mocks.getUserBases.mockResolvedValue([]);
    });

    it('loads authenticated group and poll state through guarded callbacks', async () => {
        mocks.getGroupsOfUser.mockResolvedValue([{ group_id: 'group-a' }]);
        mocks.getGroupInfo.mockResolvedValue([{ id: 'group-a', name: 'Alpha' }]);
        mocks.getGroupPolls.mockImplementation(groupId => Promise.resolve([
            { id: `${groupId}-poll`, type: 'cwl_availability', created_at: '2026-08-01' }
        ]));
        const onGroupsLoaded = vi.fn();
        const onGroupLoaded = vi.fn();
        const { createGroupSourceController } = await import(
            '../../src/assets/js/cwl/cwl-group-source-controller.js?v=20260829-public-auth-v1'
        );
        const controller = createGroupSourceController({ onGroupsLoaded, onGroupLoaded });
        controller.init(authenticated('user-a'));

        await controller.loadGroups();
        expect(onGroupsLoaded).toHaveBeenCalledWith([{ id: 'group-a', name: 'Alpha' }]);
        expect(controller.getPollCatalog().get('group-a::group-a-poll').poll.id).toBe('group-a-poll');

        await controller.loadSelectedGroup('group-a', 'group-a-poll');
        expect(onGroupLoaded).toHaveBeenCalledWith('group-a', 'group-a-poll');
        expect(controller.getGroupState('group-a')).toEqual(expect.objectContaining({
            members: [],
            clans: [],
            players: []
        }));
    });

    it('drops a group response that belongs to the previous authenticated user', async () => {
        const oldGroups = deferred();
        mocks.getGroupsOfUser.mockReturnValueOnce(oldGroups.promise);
        const onGroupsLoaded = vi.fn();
        const { createGroupSourceController } = await import(
            '../../src/assets/js/cwl/cwl-group-source-controller.js?v=20260829-public-auth-v1'
        );
        const controller = createGroupSourceController({ onGroupsLoaded });
        controller.init(authenticated('user-a'));
        const oldRequest = controller.loadGroups();

        window.dispatchEvent(new CustomEvent('clashtools:planner-auth-state-changed', {
            detail: authenticated('user-b')
        }));
        oldGroups.resolve([{ group_id: 'old-group' }]);
        await oldRequest;
        await vi.waitFor(() => expect(mocks.getGroupsOfUser).toHaveBeenCalledWith('user-b'));

        expect(mocks.getGroupInfo).not.toHaveBeenCalledWith('old-group');
        expect(onGroupsLoaded).not.toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ id: 'old-group' })])
        );
    });

    it('does not publish selected-group data after an account transition', async () => {
        const oldMembers = deferred();
        mocks.getGroupMembers.mockReturnValueOnce(oldMembers.promise);
        const onGroupLoaded = vi.fn();
        const { createGroupSourceController } = await import(
            '../../src/assets/js/cwl/cwl-group-source-controller.js?v=20260829-public-auth-v1'
        );
        const controller = createGroupSourceController({ onGroupLoaded });
        controller.init(authenticated('user-a'));
        const oldRequest = controller.loadSelectedGroup('old-group', 'old-poll');

        window.dispatchEvent(new CustomEvent('clashtools:planner-auth-state-changed', {
            detail: authenticated('user-b')
        }));
        oldMembers.resolve([{ user_id: 'user-a' }]);
        await oldRequest;

        expect(onGroupLoaded).not.toHaveBeenCalled();
        expect(controller.getGroupState('old-group')).toBeUndefined();
    });
});
