import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    pending: new Map(),
    createPlayerCard: vi.fn(),
    createClanCard: vi.fn(),
    setCanAutosave: vi.fn(),
    setLoading: vi.fn()
}));

vi.mock('../../src/assets/js/Data/config.js', () => ({
    canAutosave: false,
    isLoading: false,
    setCanAutosave: mocks.setCanAutosave,
    setLoading: mocks.setLoading
}));
vi.mock('../../src/assets/js/templates/CWLTemplates.js?v=20260829-public-auth-v1', () => ({
    createPlayerCard: mocks.createPlayerCard,
    createClanCard: mocks.createClanCard
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Plan.js?v=20260829-public-auth-v1', () => ({
    getAllPlansFromDatabase: vi.fn(),
    getPlanFromDatabase: vi.fn(planId => new Promise((resolve, reject) => {
        mocks.pending.set(planId, { resolve, reject });
    })),
    setPlanToDatabase: vi.fn()
}));
vi.mock('../../src/assets/js/API/API-Clan.js?v=20260829-public-auth-v1', () => ({ getClanInfoRequest: vi.fn() }));
vi.mock('../../src/assets/js/API/API-Functions.js?v=20260829-public-auth-v1', () => ({ getPlayerBasicData: vi.fn() }));
vi.mock('../../src/assets/js/utils/user.js', () => ({ getCurrentUserId: () => 'user-1' }));
vi.mock('../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1', () => ({ t: key => key }));
vi.mock('../../src/assets/js/cwl/cwl-availability.js?v=20260829-public-auth-v1', () => ({
    getActiveCwlPollMeta: () => ({ groupId: '', pollId: '' })
}));

describe('CWL plan switching', () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.pending.clear();
        mocks.createPlayerCard.mockClear();
        mocks.createClanCard.mockClear();
        mocks.setCanAutosave.mockClear();
        mocks.setLoading.mockClear();
        localStorage.clear();
        document.body.innerHTML = `
            <div id="available"></div>
            <div id="clans"></div>
            <p id="total">0</p>
            <input id="name">
            <select id="plans"></select>
            <span id="status"></span>`;
    });

    it('does not let a stale plan A response overwrite the newer plan B', async () => {
        const { initPlanIO, loadPlanById } = await import('../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1');
        const refs = {
            availablePlayers: document.querySelector('#available'),
            allClans: document.querySelector('#clans'),
            totalPlayerAmount: document.querySelector('#total'),
            planName: document.querySelector('#name'),
            loadPlan: document.querySelector('#plans'),
            saveStatus: document.querySelector('#status')
        };
        initPlanIO(refs);

        const loadingA = loadPlanById('plan-a');
        const loadingB = loadPlanById('plan-b');

        mocks.pending.get('plan-b').resolve({
            id: 'plan-b',
            name: 'Plan B',
            info: { schemaVersion: 2, freePlayers: [{ tag: '#BBB' }], clans: [] }
        });
        await loadingB;
        mocks.pending.get('plan-a').resolve({
            id: 'plan-a',
            name: 'Plan A',
            info: { schemaVersion: 2, freePlayers: [{ tag: '#AAA' }], clans: [] }
        });
        await loadingA;

        expect(refs.planName.value).toBe('Plan B');
        expect(mocks.createPlayerCard).toHaveBeenCalledOnce();
        expect(mocks.createPlayerCard).toHaveBeenCalledWith(expect.objectContaining({ tag: '#BBB' }), null);
        expect(localStorage.getItem('planner_id')).toBe('plan-b');
    });

    it('restores the previous plan id when the next plan fails to load', async () => {
        const { initPlanIO, loadPlanById } = await import('../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1');
        const refs = {
            availablePlayers: document.querySelector('#available'),
            allClans: document.querySelector('#clans'),
            totalPlayerAmount: document.querySelector('#total'),
            planName: document.querySelector('#name'),
            loadPlan: document.querySelector('#plans'),
            saveStatus: document.querySelector('#status')
        };
        refs.loadPlan.append(
            new Option('Plan A', 'plan-a'),
            new Option('Plan B', 'plan-b')
        );
        initPlanIO(refs);

        const loadingA = loadPlanById('plan-a');
        mocks.pending.get('plan-a').resolve({
            id: 'plan-a',
            name: 'Plan A',
            info: { schemaVersion: 2, freePlayers: [{ tag: '#AAA' }], clans: [] }
        });
        await loadingA;

        const loadingB = loadPlanById('plan-b');
        mocks.pending.get('plan-b').reject(new Error('network unavailable'));
        await loadingB;

        expect(refs.planName.value).toBe('Plan A');
        expect(refs.loadPlan.value).toBe('plan-a');
        expect(localStorage.getItem('planner_id')).toBe('plan-a');
    });

    it('round-trips clan and player priorities through plan save/load data', async () => {
        const { getCurrentPlanSnapshot, initPlanIO, loadPlanById } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1'
        );
        const refs = {
            availablePlayers: document.querySelector('#available'),
            allClans: document.querySelector('#clans'),
            totalPlayerAmount: document.querySelector('#total'),
            planName: document.querySelector('#name'),
            loadPlan: document.querySelector('#plans'),
            saveStatus: document.querySelector('#status')
        };
        refs.availablePlayers.innerHTML = `
            <article class="cwl-player-article" data-planner-card="true"
                     data-player-tag="#FREE" data-town-hall="17"
                     data-player-priority="high">
                <p class="cwl-player-name">Free</p>
                <p class="cwl-player-clan">Alpha</p>
                <p class="cwl-player-hashtag">#FREE</p>
            </article>`;
        refs.allClans.innerHTML = `
            <article class="cwl-clan-article" id="cwl-clan-template_alpha"
                     data-clan-tag="#ALPHA" data-clan-name="Alpha"
                     data-clan-capacity="15" data-clan-priority="primary">
                <select class="cwl-clan-capacity"><option selected>15</option></select>
                <img class="cwl-clan-logo" src="">
                <div class="cwl-clan-player-list">
                    <article class="cwl-player-article" data-planner-card="true"
                             data-player-tag="#LOCKED" data-town-hall="17"
                             data-player-priority="exclude">
                        <p class="cwl-player-name">Locked</p>
                        <p class="cwl-player-clan">Alpha</p>
                        <p class="cwl-player-hashtag">#LOCKED</p>
                    </article>
                </div>
            </article>`;

        initPlanIO(refs);
        const snapshot = getCurrentPlanSnapshot({ now: '2026-08-28T00:00:00.000Z' });

        expect(snapshot.schemaVersion).toBe(5);
        expect(snapshot.freePlayers[0].playerPriority).toBe('high');
        expect(snapshot.clans[0].clanPriority).toBe('primary');
        expect(snapshot.clans[0].players[0].playerPriority).toBe('exclude');

        const loading = loadPlanById('round-trip');
        mocks.pending.get('round-trip').resolve({
            id: 'round-trip',
            name: 'Round trip',
            info: snapshot
        });
        await loading;

        expect(mocks.createPlayerCard).toHaveBeenCalledWith(
            expect.objectContaining({ tag: '#FREE', playerPriority: 'high' }),
            null
        );
        expect(mocks.createPlayerCard).toHaveBeenCalledWith(
            expect.objectContaining({ tag: '#LOCKED', playerPriority: 'exclude' }),
            'alpha'
        );
        expect(mocks.createClanCard).toHaveBeenCalledWith(
            expect.objectContaining({ tag: '#ALPHA', clanPriority: 'primary' }),
            15,
            'alpha'
        );
    });
});
