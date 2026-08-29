import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    deletePlan: vi.fn().mockResolvedValue({ success: true }),
    resolveAuthState: vi.fn().mockResolvedValue({
        status: 'authenticated',
        session: { user: { id: 'user-1' } }
    }),
    getAllPlans: vi.fn().mockResolvedValue([{
        id: 'plan-1',
        name: 'Juli',
        isOwner: true,
        info: { freePlayers: [], clans: [] }
    }])
}));

vi.mock('../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1', () => ({
    getLanguage: () => 'nl',
    initI18n: vi.fn(),
    t: (key, values = {}) => {
        const value = ({
        'drafts.open': 'Open',
        'drafts.rename': 'Hernoem',
        'drafts.copy': 'Kopieer',
        'drafts.delete': 'Verwijder',
        'drafts.owner': 'Jouw plan',
        'drafts.loading': 'Laden',
        'drafts.deleted': 'Verwijderd',
        'drafts.deleteConfirm': 'Bevestigen',
        'drafts.empty': 'Geen plannen',
        'drafts.noMatches': 'Geen plannen gevonden',
        'drafts.results': '{visible} van {total} plannen zichtbaar',
        'plans.name': 'Plan',
        'plans.clans': 'Clans',
        'plans.freeRoster': 'Vrij roster',
        'plans.updated': 'Bijgewerkt',
        'plans.unknownDate': 'Onbekend'
        })[key] || key;
        return Object.entries(values).reduce((result, [name, replacement]) => result.replaceAll(`{${name}}`, replacement), value);
    }
}));
vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => ({
    AUTH_STATES: { AUTHENTICATED: 'authenticated' },
    resolveAuthState: mocks.resolveAuthState
}));
vi.mock('../../src/assets/js/utils/user.js', () => ({ getCurrentUserId: () => 'user-1' }));
vi.mock('../../src/assets/js/Supabase/Supabase-Plan.js?v=20260829-public-auth-v1', () => ({
    copyPlan: vi.fn(),
    deletePlan: mocks.deletePlan,
    getAllPlansFromDatabase: mocks.getAllPlans,
    renamePlan: vi.fn()
}));

describe('saved plan actions', () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.resolveAuthState.mockReset().mockResolvedValue({
            status: 'authenticated',
            session: { user: { id: 'user-1' } }
        });
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
            <input id="drafts-search"><select id="drafts-sort"><option value="updated-desc">Recent</option><option value="updated-asc">Oudst</option><option value="name-asc">Naam A-Z</option><option value="name-desc">Naam Z-A</option></select>
            <p id="drafts-filter-status"></p>
            <table><tbody id="draft-cwl-container"></tbody></table>`;
    });

    it('selects a plan when opening and removes it after confirmation', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        await import('../../src/assets/js/pages/cwl-planner-drafts.js?v=20260829-public-auth-v1');
        await vi.waitFor(() => expect(mocks.getAllPlans).toHaveBeenCalled());
        await vi.waitFor(() => expect(document.querySelector('[data-plan-id="plan-1"]'), document.body.innerHTML).not.toBeNull());

        const open = [...document.querySelectorAll('a')].find(link => link.textContent === 'Open');
        open.addEventListener('click', event => event.preventDefault());
        open.click();
        expect(localStorage.getItem('clashpanel:planner:user-1:active')).toBe('plan-1');
        expect(localStorage.getItem('planner_id')).toBeNull();

        const remove = [...document.querySelectorAll('button')].find(button => button.textContent === 'Verwijder');
        remove.click();
        await vi.waitFor(() => expect(mocks.deletePlan).toHaveBeenCalledWith('plan-1', 'user-1'));
        expect(document.querySelector('[data-plan-id="plan-1"]')).toBeNull();
        expect(localStorage.getItem('clashpanel:planner:user-1:active')).toBeNull();
    });

    it('filters and sorts already loaded plans without another request', async () => {
        mocks.getAllPlans.mockResolvedValue([
            { id: 'bravo', name: 'Bravo', updated_at: '2026-06-01T10:00:00Z', isOwner: true, info: { freePlayers: [], clans: [] } },
            { id: 'alpha', name: 'Álpha', updated_at: '2026-07-10T10:00:00Z', isOwner: true, info: { freePlayers: [], clans: [] } },
            { id: 'charlie', name: 'Charlie', updated_at: null, isOwner: false, info: { freePlayers: [], clans: [] } }
        ]);
        await import('../../src/assets/js/pages/cwl-planner-drafts.js?v=20260829-public-auth-v1');
        await vi.waitFor(() => expect(document.querySelectorAll('[data-plan-id]')).toHaveLength(3));

        const names = () => [...document.querySelectorAll('[data-plan-id] td:first-child strong')].map(element => element.textContent);
        expect(names()).toEqual(['Álpha', 'Bravo', 'Charlie']);

        const sort = document.querySelector('#drafts-sort');
        sort.value = 'name-desc';
        sort.dispatchEvent(new Event('change', { bubbles: true }));
        expect(names()).toEqual(['Charlie', 'Bravo', 'Álpha']);

        const search = document.querySelector('#drafts-search');
        search.value = 'alpha';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(names()).toEqual(['Álpha']);
        expect(document.querySelector('#drafts-filter-status').textContent).toBe('1 van 3 plannen zichtbaar');

        search.value = 'bestaat niet';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        expect(document.querySelectorAll('[data-plan-id]')).toHaveLength(0);
        expect(document.querySelector('#draft-cwl-container').textContent).toContain('Geen plannen gevonden');
        expect(mocks.getAllPlans).toHaveBeenCalledTimes(1);
    });
});
