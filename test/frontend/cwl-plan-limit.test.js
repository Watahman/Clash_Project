import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getAllPlansFromDatabase: vi.fn(),
    getPlanFromDatabase: vi.fn(),
    setPlanToDatabase: vi.fn()
}));

vi.mock('../../src/assets/js/Data/config.js', () => ({
    canAutosave: true,
    isLoading: false,
    setCanAutosave: vi.fn(),
    setLoading: vi.fn()
}));
vi.mock('../../src/assets/js/templates/CWLTemplates.js', () => ({
    createPlayerCard: vi.fn(),
    createClanCard: vi.fn(),
    applyClanLeagueRestriction: vi.fn()
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Plan.js', () => ({
    getAllPlansFromDatabase: mocks.getAllPlansFromDatabase,
    getPlanFromDatabase: mocks.getPlanFromDatabase,
    setPlanToDatabase: mocks.setPlanToDatabase
}));
vi.mock('../../src/assets/js/API/API-Clan.js', () => ({ getClanInfoRequest: vi.fn() }));
vi.mock('../../src/assets/js/API/API-Functions.js', () => ({ getPlayerBasicData: vi.fn() }));
vi.mock('../../src/assets/js/utils/user.js', () => ({ getCurrentUserId: () => 'user-1' }));
vi.mock('../../src/assets/js/i18n/i18n.js', () => ({ t: key => key }));
vi.mock('../../src/assets/js/cwl/cwl-availability.js', () => ({
    getActiveCwlPollMeta: () => ({ groupId: '', pollId: '' })
}));

const plans = [
    {
        id: 'plan-1',
        name: 'Plan 1',
        isOwner: true,
        revision: 1,
        info: { schemaVersion: 2, freePlayers: [], clans: [] }
    },
    {
        id: 'plan-2',
        name: 'Plan 2',
        isOwner: true,
        revision: 1,
        info: { schemaVersion: 2, freePlayers: [], clans: [] }
    },
    {
        id: 'plan-3',
        name: 'Plan 3',
        isOwner: true,
        revision: 1,
        info: { schemaVersion: 2, freePlayers: [], clans: [] }
    }
];

function plannerRefs() {
    return {
        availablePlayers: document.querySelector('#available'),
        allClans: document.querySelector('#clans'),
        totalPlayerAmount: document.querySelector('#total'),
        planName: document.querySelector('#name'),
        loadPlan: document.querySelector('#plans')
    };
}

describe('CWL saved plan limit', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        mocks.getAllPlansFromDatabase.mockReset().mockResolvedValue(plans);
        mocks.getPlanFromDatabase.mockReset();
        mocks.setPlanToDatabase.mockReset();
        document.body.innerHTML = `
            <div id="available"></div>
            <div id="clans"></div>
            <p id="total">0</p>
            <input id="name" value="Fourth plan">
            <select id="plans"></select>
            <span id="cwl-save-status"></span>
            <p id="cwl-plan-limit-feedback" hidden></p>`;
    });

    it('blocks a fourth new plan and shows localized feedback', async () => {
        const { initPlanIO, loadAllPlans, savePlan } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js'
        );
        initPlanIO(plannerRefs());
        await loadAllPlans();

        const result = await savePlan({ immediate: true });

        expect(result).toBeNull();
        expect(mocks.setPlanToDatabase).not.toHaveBeenCalled();
        expect(document.querySelector('#cwl-plan-limit-feedback').hidden).toBe(false);
        expect(document.querySelector('#cwl-plan-limit-feedback').textContent)
            .toBe('cwl.planLimitReached');
    });

    it('still saves changes to an existing plan when three plans exist', async () => {
        localStorage.setItem('planner_id', 'plan-1');
        mocks.setPlanToDatabase.mockResolvedValue({
            uuid: 'plan-1',
            revision: 2
        });
        const { initPlanIO, loadAllPlans, savePlan } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js'
        );
        const refs = plannerRefs();
        initPlanIO(refs);
        await loadAllPlans();
        refs.planName.value = 'Updated Plan 1';

        const result = await savePlan({ immediate: true });

        expect(result).toEqual({ uuid: 'plan-1', revision: 2 });
        expect(mocks.setPlanToDatabase).toHaveBeenCalledWith(
            'user-1',
            'plan-1',
            'Updated Plan 1',
            expect.any(Object),
            1
        );
        expect(document.querySelector('#cwl-plan-limit-feedback').hidden).toBe(true);
    });

    it('does not count shared plans toward the personal limit', async () => {
        mocks.getAllPlansFromDatabase.mockResolvedValue([
            ...plans.slice(0, 2),
            { ...plans[2], isOwner: false }
        ]);
        mocks.setPlanToDatabase.mockResolvedValue({
            uuid: 'plan-4',
            revision: 1
        });
        const { initPlanIO, loadAllPlans, savePlan } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js'
        );
        const refs = plannerRefs();
        initPlanIO(refs);
        await loadAllPlans();
        refs.planName.value = 'Third owned plan';

        const result = await savePlan({ immediate: true });

        expect(result).toEqual({ uuid: 'plan-4', revision: 1 });
        expect(mocks.setPlanToDatabase).toHaveBeenCalledOnce();
    });
});
