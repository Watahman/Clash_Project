import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: (key, params = {}) => ({
        'planner.noRosterMatches': 'Geen spelers gevonden voor deze zoekopdracht.',
        'planner.rosterResults': `${params.visible} van ${params.total} spelers zichtbaar`
    })[key] || key
}));

function playerCard(name, tag) {
    const card = document.createElement('article');
    card.className = 'cwl-player-article';
    card.dataset.plannerCard = 'true';
    card.dataset.playerTag = tag;
    card.innerHTML = `<strong class="cwl-player-name">${name}</strong><span class="cwl-player-hashtag">${tag}</span>`;
    return card;
}

describe('free roster filter', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input id="search" type="search">
            <p id="status"></p>
            <div id="roster"></div>`;
    });

    it('filters existing cards client-side by player name or tag', async () => {
        const { initFreeRosterFilter } = await import('../../src/assets/js/cwl/cwl-roster-filter.js');
        const container = document.querySelector('#roster');
        const input = document.querySelector('#search');
        const status = document.querySelector('#status');
        container.append(playerCard('North Guard', '#ABC123'), playerCard('South Wing', '#XYZ789'));
        const cleanup = initFreeRosterFilter({ container, input, status });

        input.value = 'north';
        input.dispatchEvent(new Event('input'));
        expect(container.children[0].hidden).toBe(false);
        expect(container.children[1].hidden).toBe(true);
        expect(status.textContent).toBe('1 van 2 spelers zichtbaar');

        input.value = 'xyz789';
        input.dispatchEvent(new Event('input'));
        expect(container.children[0].hidden).toBe(true);
        expect(container.children[1].hidden).toBe(false);
        cleanup();
    });

    it('shows a distinct no-results state without changing roster data', async () => {
        const { initFreeRosterFilter } = await import('../../src/assets/js/cwl/cwl-roster-filter.js');
        const container = document.querySelector('#roster');
        const input = document.querySelector('#search');
        container.append(playerCard('North Guard', '#ABC123'));
        const cleanup = initFreeRosterFilter({ container, input, status: document.querySelector('#status') });

        input.value = 'missing';
        input.dispatchEvent(new Event('input'));
        expect(container.dataset.filterEmpty).toBe('true');
        expect(container.dataset.filterEmptyLabel).toBe('Geen spelers gevonden voor deze zoekopdracht.');
        expect(container.querySelectorAll('.cwl-player-article')).toHaveLength(1);
        cleanup();
    });

    it('reapplies the active query when a player is added or enriched', async () => {
        const { initFreeRosterFilter } = await import('../../src/assets/js/cwl/cwl-roster-filter.js');
        const container = document.querySelector('#roster');
        const input = document.querySelector('#search');
        input.value = 'guard';
        const cleanup = initFreeRosterFilter({ container, input, status: document.querySelector('#status') });

        const card = playerCard('Loading', '#ABC123');
        container.append(card);
        await vi.waitFor(() => expect(card.hidden).toBe(true));
        card.querySelector('.cwl-player-name').textContent = 'Guard One';
        await vi.waitFor(() => expect(card.hidden).toBe(false));
        cleanup();
    });
});
