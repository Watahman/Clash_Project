import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    deletePlan: vi.fn().mockResolvedValue({ success: true }),
    getAllPlans: vi.fn().mockResolvedValue([{
        id: 'plan-1',
        name: 'Juli',
        isOwner: true,
        info: { freePlayers: [], clans: [] }
    }])
}));

vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    getLanguage: () => 'nl',
    initI18n: vi.fn(),
    t: (key) => ({
        'drafts.open': 'Open',
        'drafts.rename': 'Hernoem',
        'drafts.copy': 'Kopieer',
        'drafts.delete': 'Verwijder',
        'drafts.owner': 'Jouw plan',
        'drafts.loading': 'Laden',
        'drafts.deleted': 'Verwijderd',
        'drafts.deleteConfirm': 'Bevestigen',
        'plans.name': 'Plan',
        'plans.clans': 'Clans',
        'plans.freeRoster': 'Vrij roster',
        'plans.updated': 'Bijgewerkt',
        'plans.unknownDate': 'Onbekend'
    })[key] || key
}));
vi.mock('../../src/assets/js/profile/profile_popup.js', () => ({ profileHTML: vi.fn() }));
vi.mock('../../src/assets/js/auth/auth-client.js', () => ({ syncAuthSession: vi.fn().mockResolvedValue(null) }));
vi.mock('../../src/assets/js/utils/user.js', () => ({ getCurrentUserId: () => 'user-1' }));
vi.mock('../../src/assets/js/Supabase/Supabase-Plan.js', () => ({
    copyPlan: vi.fn(),
    deletePlan: mocks.deletePlan,
    getAllPlansFromDatabase: mocks.getAllPlans,
    renamePlan: vi.fn()
}));

describe('saved plan actions', () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.deletePlan.mockClear();
        mocks.getAllPlans.mockReset().mockResolvedValue([{
            id: 'plan-1',
            name: 'Juli',
            isOwner: true,
            info: { freePlayers: [], clans: [] }
        }]);
        localStorage.clear();
        document.body.innerHTML = `
            <p id="drafts-status"></p>
            <table><tbody id="draft-cwl-container"></tbody></table>
            <div class="profile-placeholder"></div>`;
    });

    it('selects a plan when opening and removes it after confirmation', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        await import('../../src/assets/js/pages/cwl-planner-drafts.js');
        await vi.waitFor(() => expect(mocks.getAllPlans).toHaveBeenCalled());
        await vi.waitFor(() => expect(document.querySelector('[data-plan-id="plan-1"]'), document.body.innerHTML).not.toBeNull());

        const open = [...document.querySelectorAll('a')].find(link => link.textContent === 'Open');
        open.addEventListener('click', event => event.preventDefault());
        open.click();
        expect(localStorage.getItem('planner_id')).toBe('plan-1');

        const remove = [...document.querySelectorAll('button')].find(button => button.textContent === 'Verwijder');
        remove.click();
        await vi.waitFor(() => expect(mocks.deletePlan).toHaveBeenCalledWith('plan-1', 'user-1'));
        expect(document.querySelector('[data-plan-id="plan-1"]')).toBeNull();
        expect(localStorage.getItem('planner_id')).toBeNull();
    });
});
