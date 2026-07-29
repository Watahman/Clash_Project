import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
    getGroupPolls: vi.fn(),
    createGroupPoll: vi.fn(),
    deleteGroupPoll: vi.fn(),
    answerGroupPoll: vi.fn(),
    setGroupPollStatus: vi.fn(),
    sendGroupPollReminder: vi.fn()
}));

vi.mock('../../src/assets/js/Supabase/Supabase-GroupPolls.js', () => mocks);
vi.mock('../../src/assets/js/Supabase/Supabase-User.js', () => ({
    checkUserId: vi.fn()
}));
vi.mock('../../src/assets/js/utils/user.js', () => ({
    getCurrentUserId: () => 'user-1'
}));
vi.mock('../../src/assets/js/utils/loading-state.js', () => ({
    withGlobalLoading: operation => operation()
}));
vi.mock('../../src/assets/js/utils/backdrop-click.js', () => ({
    bindBackdropClick: vi.fn()
}));
vi.mock('../../src/assets/js/groups/groups-roles.js', () => ({
    isGroupAdmin: role => role === 'leader' || role === 'co_leader'
}));
vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: (key, params = {}) => {
        const values = {
            'groups.deletePoll': 'Delete',
            'groups.deletePollConfirm': `Delete ${params.title}?`,
            'groups.viewResults': 'Results',
            'groups.closePoll': 'Close',
            'groups.openPoll': 'Reopen',
            'groups.noPolls': 'No polls',
            'groups.noPollSelected': 'No poll selected',
            'groups.loading': 'Loading',
            'op.roundsShort': 'rounds'
        };
        return values[key] || key;
    }
}));

describe('Clan Family poll management', () => {
    beforeEach(() => {
        sessionStorage.clear();
        document.body.innerHTML = `
            <button id="groups-poll-create-btn"></button>
            <input id="groups-poll-title-input">
            <input id="groups-poll-rounds-input" value="7">
            <p id="groups-poll-limit-feedback" hidden></p>
            <div id="groups-poll-notice" class="hidden"></div>
            <div id="groups-availability-empty"></div>
            <div id="groups-admin-polls-list"></div>
            <div id="groups-poll-results"></div>
            <button id="groups-poll-reminder-btn"></button>`;
    });

    it('caps a Clan Family at three polls and lets an admin delete a closed poll', async () => {
        const threePolls = [
            { id: 'poll-open', title: 'July CWL', type: 'cwl_availability', status: 'open', rounds: 7 },
            { id: 'poll-closed', title: 'June CWL', type: 'cwl_availability', status: 'closed', rounds: 7 },
            { id: 'poll-archived', title: 'May CWL', type: 'cwl_availability', status: 'archived', rounds: 7 }
        ];
        mocks.getGroupPolls
            .mockResolvedValueOnce(threePolls)
            .mockResolvedValueOnce(threePolls.filter(poll => poll.id !== 'poll-closed'));
        mocks.deleteGroupPoll.mockResolvedValue([{ id: 'poll-closed' }]);
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        const { initGroupPolls } = await import('../../src/assets/js/groups/groups-polls.js');
        initGroupPolls(message => Object.assign(document.createElement('p'), { textContent: message }));
        window.dispatchEvent(new CustomEvent('clashtools:group-opened', {
            detail: {
                group: { id: 'group-1', name: 'Alpha' },
                members: [],
                currentRole: 'leader'
            }
        }));

        const createButton = document.querySelector('#groups-poll-create-btn');
        const limitFeedback = document.querySelector('#groups-poll-limit-feedback');
        await vi.waitFor(() => expect(createButton.disabled).toBe(true));
        expect(limitFeedback.hidden).toBe(false);
        expect(document.querySelectorAll('.btn-groups-danger')).toHaveLength(3);

        const closedPoll = [...document.querySelectorAll('.groups-admin-member')]
            .find(node => node.textContent.includes('June CWL'));
        closedPoll.querySelector('.btn-groups-danger').click();

        await vi.waitFor(() => expect(mocks.deleteGroupPoll).toHaveBeenCalledWith(
            'group-1',
            'user-1',
            'poll-closed'
        ));
        await vi.waitFor(() => expect(createButton.disabled).toBe(false));
        expect(limitFeedback.hidden).toBe(true);
        expect(document.querySelector('#groups-admin-polls-list').textContent).not.toContain('June CWL');
    });

    it('enforces the three-poll cap below the interface as well', () => {
        const backend = readFileSync('src/Java/SUPABASE_GroupPolls.java', 'utf8');
        const migration = readFileSync(
            'database/migrations/20260729140022_limit_group_polls_to_three.sql',
            'utf8'
        );

        expect(backend).toContain('MAX_POLLS_PER_GROUP = 3');
        expect(backend).toContain('access.requireAdmin(groupId, actorId)');
        expect(backend).toContain('SUPABASE_Client.deleteColumn(');
        expect(migration).toContain('before insert on public.group_polls');
        expect(migration).toContain("raise exception 'POLL_LIMIT_REACHED'");
        expect(migration).toContain('pg_advisory_xact_lock');
    });
});
