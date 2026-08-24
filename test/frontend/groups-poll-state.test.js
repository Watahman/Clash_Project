import { describe, expect, it } from 'vitest';
import {
    clonePolls,
    findLatestOpenCwlPoll,
    parsePollAccounts,
    readPollAccountAnswer
} from '../../src/assets/js/groups/groups-polls-state.js';

describe('Clan Family poll state helpers', () => {
    it('normalizes account storage and selects the latest open CWL poll', () => {
        expect(parsePollAccounts(JSON.stringify([{ tag: '#ONE' }]))).toEqual([{ tag: '#ONE' }]);
        expect(parsePollAccounts('not json')).toEqual([]);
        expect(findLatestOpenCwlPoll([
            { id: 'closed', type: 'cwl_availability', status: 'closed', created_at: '2026-08-02' },
            { id: 'old', type: 'cwl_availability', status: 'open', created_at: '2026-08-01' },
            { id: 'latest', type: 'cwl_availability', status: 'open', created_at: '2026-08-03' }
        ])?.id).toBe('latest');
    });

    it('deep-clones fixture poll answers before local-only mutations', () => {
        const source = [{ id: 'poll-1', answers: { user: { accounts: [{ tag: '#ONE', days: { 1: true } }] } } }];
        const cloned = clonePolls(source);
        cloned[0].answers.user.accounts[0].days[1] = false;
        expect(source[0].answers.user.accounts[0].days[1]).toBe(true);
    });

    it('reads account/day choices without leaking disabled days', () => {
        document.body.innerHTML = `<div class="groups-poll-account-card" data-name="One" data-tag="#ONE" data-town-hall="17">
            <input class="groups-poll-wants" type="checkbox">
            <input data-day="1" type="checkbox" checked>
            <input data-day="2" type="checkbox" checked>
        </div>`;
        const answer = readPollAccountAnswer(document.querySelector('.groups-poll-account-card'));
        expect(answer.wantsCwl).toBe(false);
        expect(answer.days).toEqual({});
    });
});
