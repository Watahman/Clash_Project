import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getGroupsOfUser: vi.fn(),
    getGroupInfo: vi.fn(),
    getGroupPolls: vi.fn(),
    setActiveCwlPoll: vi.fn(),
    clearActiveCwlPoll: vi.fn(),
    activeMeta: { groupId: '', pollId: '' }
}));

vi.mock('../../src/assets/js/Supabase/Supabase-Group.js', () => ({
    getGroupsOfUser: mocks.getGroupsOfUser,
    getGroupInfo: mocks.getGroupInfo,
    getGroupMembers: vi.fn().mockResolvedValue([]),
    getGroupClans: vi.fn().mockResolvedValue([])
}));
vi.mock('../../src/assets/js/Supabase/Supabase-GroupPolls.js', () => ({
    getGroupPolls: mocks.getGroupPolls
}));
vi.mock('../../src/assets/js/Supabase/Supabase-User.js', () => ({
    getUserBases: vi.fn().mockResolvedValue([])
}));
vi.mock('../../src/assets/js/templates/CWLTemplates.js', () => ({
    createClanCard: vi.fn(),
    createPlayerCard: vi.fn()
}));
vi.mock('../../src/assets/js/utils/user.js', () => ({
    getCurrentUserId: () => 'user-1'
}));
vi.mock('../../src/assets/js/cwl/cwl-availability.js', () => ({
    clearActiveCwlPoll: () => {
        mocks.activeMeta = { groupId: '', pollId: '' };
        mocks.clearActiveCwlPoll();
    },
    getActiveCwlPollMeta: () => mocks.activeMeta,
    setActiveCwlPoll: (groupId, poll) => {
        mocks.activeMeta = { groupId, pollId: poll.id };
        mocks.setActiveCwlPoll(groupId, poll);
    }
}));
vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: key => ({
        'cwl.noPollSelected': 'No poll selected',
        'cwl.pollSelectLoading': 'Loading polls...',
        'cwl.noGroupPolls': 'No group polls available',
        'cwl.pollSelectError': 'Could not load polls',
        'cwl.pollStatusOpen': 'Open',
        'cwl.pollStatusClosed': 'Closed',
        'cwl.pollStatusArchived': 'Archived'
    })[key] || key
}));

describe('CWL roster poll selector', () => {
    beforeEach(() => {
        mocks.activeMeta = { groupId: '', pollId: '' };
        mocks.setActiveCwlPoll.mockClear();
        mocks.clearActiveCwlPoll.mockClear();
        mocks.getGroupsOfUser.mockResolvedValue([
            { group_id: 'group-1' },
            { group_id: 'group-2' }
        ]);
        mocks.getGroupInfo.mockImplementation(groupId => Promise.resolve([{
            id: groupId,
            name: groupId === 'group-1' ? 'Alpha clan' : 'Beta clan'
        }]));
        mocks.getGroupPolls.mockImplementation(groupId => Promise.resolve(groupId === 'group-1'
            ? [
                { id: 'poll-old', type: 'cwl_availability', title: 'June CWL', status: 'closed', created_at: '2026-06-01' },
                { id: 'poll-new', type: 'cwl_availability', title: 'July CWL', status: 'open', created_at: '2026-07-01' }
            ]
            : [
                { id: 'poll-beta', type: 'cwl_availability', title: 'Beta July', status: 'archived', created_at: '2026-07-02' }
            ]));

        document.body.innerHTML = `
            <select id="group-select"><option value="">Select group</option></select>
            <select id="modal-poll-select"></select>
            <select id="roster-poll-select" disabled></select>
            <div id="group-preview"></div>
            <div id="group-preview-list"></div>
            <div id="linked-clans"></div>
            <button id="load-group"></button>`;
    });

    it('groups every available poll and activates a selection immediately', async () => {
        const { initGroupOverlay } = await import('../../src/assets/js/cwl/cwl-group.js');
        const rosterPollSelect = document.querySelector('#roster-poll-select');
        const changed = vi.fn();
        window.addEventListener('clashtools:cwl-active-poll-changed', changed, { once: true });

        initGroupOverlay(document.querySelector('#group-select'), {
            selectGroupPoll: document.querySelector('#modal-poll-select'),
            rosterPollSelect,
            groupPreview: document.querySelector('#group-preview'),
            groupPreviewList: document.querySelector('#group-preview-list'),
            groupLinkedClans: document.querySelector('#linked-clans'),
            loadGroupBtn: document.querySelector('#load-group')
        });

        await vi.waitFor(() => expect(rosterPollSelect.disabled).toBe(false));
        expect([...rosterPollSelect.querySelectorAll('optgroup')].map(group => group.label))
            .toEqual(['Alpha clan', 'Beta clan']);
        expect([...rosterPollSelect.options].map(option => option.value)).toEqual([
            '',
            'group-1::poll-new',
            'group-1::poll-old',
            'group-2::poll-beta'
        ]);

        rosterPollSelect.value = 'group-2::poll-beta';
        rosterPollSelect.dispatchEvent(new Event('change'));

        expect(mocks.setActiveCwlPoll).toHaveBeenCalledWith(
            'group-2',
            expect.objectContaining({ id: 'poll-beta' })
        );
        expect(changed).toHaveBeenCalledWith(expect.objectContaining({
            detail: { groupId: 'group-2', pollId: 'poll-beta' }
        }));
    });
});
