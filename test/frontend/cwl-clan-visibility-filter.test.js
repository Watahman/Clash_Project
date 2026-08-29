import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1', () => ({
    t: (key) => ({
        'planner.allClans': 'All clans'
    })[key] || key
}));

describe('CWL clan visibility filter', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <label><select id="visibility"></select></label>
            <article id="cwl-all-clans">
                ${clanCard('alpha', 'Alpha', '#A', 'primary')}
                ${clanCard('beta', 'Beta', '#B', 'secondary')}
            </article>
            <div id="cwl-available-players">
                <article class="cwl-player-article" data-planner-card="true" data-player-tag="#P1"></article>
            </div>`;
    });

    it('populates clan choices and hides columns without changing plan data', async () => {
        const { initClanVisibilityFilter } = await import(
            '../../src/assets/js/cwl/cwl-clan-visibility-filter.js?v=20260829-public-auth-v1'
        );
        const container = document.querySelector('#cwl-all-clans');
        const select = document.querySelector('#visibility');
        const alpha = container.querySelector('#cwl-clan-template_alpha');
        const beta = container.querySelector('#cwl-clan-template_beta');
        const player = document.querySelector('#cwl-available-players [data-player-tag="#P1"]');
        const alphaPriority = alpha.dataset.clanPriority;
        const betaPriority = beta.dataset.clanPriority;

        const cleanup = initClanVisibilityFilter({ container, select });
        await vi.waitFor(() => expect(select.options).toHaveLength(3));
        expect([...select.options].map(option => [option.value, option.textContent])).toEqual([
            ['', 'All clans'], ['alpha', 'Alpha'], ['beta', 'Beta']
        ]);
        expect(alpha.hidden).toBe(false);
        expect(beta.hidden).toBe(false);

        select.value = 'beta';
        select.dispatchEvent(new Event('change'));
        expect(alpha.hidden).toBe(true);
        expect(beta.hidden).toBe(false);
        expect(alpha.dataset.clanPriority).toBe(alphaPriority);
        expect(beta.dataset.clanPriority).toBe(betaPriority);
        expect(container.querySelectorAll('.cwl-clan-article')).toHaveLength(2);
        expect(player.parentElement.id).toBe('cwl-available-players');

        cleanup();
    });

    it('keeps the visual selection when a new clan column is rendered', async () => {
        const { initClanVisibilityFilter } = await import(
            '../../src/assets/js/cwl/cwl-clan-visibility-filter.js?v=20260829-public-auth-v1'
        );
        const container = document.querySelector('#cwl-all-clans');
        const select = document.querySelector('#visibility');
        const cleanup = initClanVisibilityFilter({ container, select });
        await vi.waitFor(() => expect(select.options).toHaveLength(3));
        select.value = 'beta';
        select.dispatchEvent(new Event('change'));

        container.insertAdjacentHTML('beforeend', clanCard('gamma', 'Gamma', '#C', 'development'));
        await vi.waitFor(() => expect(select.options).toHaveLength(4));
        expect(select.value).toBe('beta');
        expect(container.querySelector('#cwl-clan-template_alpha').hidden).toBe(true);
        expect(container.querySelector('#cwl-clan-template_beta').hidden).toBe(false);
        expect(container.querySelector('#cwl-clan-template_gamma').hidden).toBe(true);
        cleanup();
    });
});

function clanCard(id, name, tag, priority) {
    return `<article class="cwl-clan-article" id="cwl-clan-template_${id}"
        data-clan-name="${name}" data-clan-tag="${tag}" data-clan-priority="${priority}">
        <h3 class="cwl-clan-name">${name}</h3>
        <select class="cwl-clan-capacity"><option selected value="15">15</option></select>
        <div class="cwl-clan-player-list"></div>
    </article>`;
}
