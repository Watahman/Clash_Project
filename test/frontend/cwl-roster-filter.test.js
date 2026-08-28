import { beforeEach, describe, expect, it, vi } from 'vitest';

const performanceMocks = vi.hoisted(() => ({
    getPlayerPerformance: vi.fn(() => null),
    loadPlayerPerformanceBatch: vi.fn(() => Promise.resolve({}))
}));

vi.mock('../../src/assets/js/cwl/player-performance-client.js', () => performanceMocks);

vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: (key, params = {}) => ({
        'planner.noRosterMatches': 'Geen spelers gevonden voor deze zoekopdracht.',
        'planner.rosterResults': `${params.visible} van ${params.total} spelers zichtbaar`
    })[key] || key
}));

function playerCard(name, tag, options = {}) {
    const card = document.createElement('article');
    card.className = 'cwl-player-article';
    card.dataset.plannerCard = 'true';
    card.dataset.playerTag = tag;
    if (options.source) card.dataset.source = options.source;
    if (options.availability) card.dataset.availability = options.availability;
    if (options.townHall) card.dataset.townHall = String(options.townHall);
    card.innerHTML = `<strong class="cwl-player-name">${name}</strong><span class="cwl-player-hashtag">${tag}</span>`;
    return card;
}

describe('free roster filter', () => {
    beforeEach(() => {
        performanceMocks.getPlayerPerformance.mockReset();
        performanceMocks.getPlayerPerformance.mockReturnValue(null);
        performanceMocks.loadPlayerPerformanceBatch.mockReset();
        performanceMocks.loadPlayerPerformanceBatch.mockResolvedValue({});
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
        await vi.waitFor(() => {
            expect(container.children[0].hidden).toBe(false);
            expect(container.children[1].hidden).toBe(true);
            expect(status.textContent).toBe('1 van 2 spelers zichtbaar');
        });

        input.value = 'xyz789';
        input.dispatchEvent(new Event('input'));
        await vi.waitFor(() => {
            expect(container.children[0].hidden).toBe(true);
            expect(container.children[1].hidden).toBe(false);
        });
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
        await vi.waitFor(() => {
            expect(container.dataset.filterEmpty).toBe('true');
            expect(container.dataset.filterEmptyLabel)
                .toBe('Geen spelers gevonden voor deze zoekopdracht.');
            expect(container.querySelectorAll('.cwl-player-article')).toHaveLength(1);
        });
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

    it('combines roster filters and sorts without changing planner ownership data', async () => {
        const { initFreeRosterFilter } = await import('../../src/assets/js/cwl/cwl-roster-filter.js');
        const container = document.querySelector('#roster');
        const input = document.querySelector('#search');
        const sourceSelect = document.createElement('select');
        const performanceMin = document.createElement('input');
        const performanceMax = document.createElement('input');
        const availabilitySelect = document.createElement('select');
        const sorting = document.createElement('select');
        availabilitySelect.innerHTML = '<option value="all">All</option><option value="yes">Yes</option>';
        sorting.innerHTML = '<option value="townhall">TH</option><option value="performance">Performance</option>';

        const cards = [
            playerCard('Alpha Guard', '#AAA', { source: 'North', availability: 'yes', townHall: 17 }),
            playerCard('Bravo Guard', '#BBB', { source: 'South', availability: 'yes', townHall: 16 }),
            playerCard('Charlie Guard', '#CCC', { source: 'North', availability: 'no', townHall: 17 })
        ];
        cards.forEach(card => {
            card._cwlPlayer = { clanName: card.dataset.source };
            container.append(card);
        });
        const performance = {
            '#AAA': { performance: 84, reliability: 90 },
            '#BBB': { performance: 96, reliability: 70 },
            '#CCC': { performance: 99, reliability: 99 }
        };
        performanceMocks.getPlayerPerformance.mockImplementation(tag => performance[tag]);
        const originalTags = cards.map(card => card.dataset.playerTag);
        const cleanup = initFreeRosterFilter({
            container,
            input,
            status: document.querySelector('#status'),
            sourceSelect,
            performanceMin,
            performanceMax,
            availabilitySelect,
            sorting
        });
        await vi.waitFor(() => expect([...sourceSelect.options].map(option => option.value))
            .toEqual(['', 'North', 'South']));

        sourceSelect.value = 'North';
        availabilitySelect.value = 'yes';
        performanceMin.value = '80';
        performanceMax.value = '90';
        sorting.value = 'performance';
        [sourceSelect, availabilitySelect, performanceMin, performanceMax, sorting]
            .forEach(control => control.dispatchEvent(new Event(
                control === performanceMin || control === performanceMax ? 'input' : 'change'
            )));

        await vi.waitFor(() => {
            expect(cards[0].hidden).toBe(false);
            expect(cards[1].hidden).toBe(true);
            expect(cards[2].hidden).toBe(true);
        });
        expect(performanceMocks.loadPlayerPerformanceBatch).toHaveBeenCalled();
        expect(cards.map(card => card.dataset.playerTag)).toEqual(originalTags);
        expect(cards.map(card => card._cwlPlayer.clanName)).toEqual(['North', 'South', 'North']);
        expect(container.querySelectorAll('.cwl-player-article')).toHaveLength(3);
        cleanup();
    });

    it('keeps performance loading lazy until a performance filter or sort is used', async () => {
        const { initFreeRosterFilter } = await import('../../src/assets/js/cwl/cwl-roster-filter.js');
        const container = document.querySelector('#roster');
        const input = document.querySelector('#search');
        const sorting = document.createElement('select');
        sorting.innerHTML = '<option value="townhall">TH</option><option value="performance">Performance</option>';
        container.append(playerCard('North Guard', '#AAA'));
        const cleanup = initFreeRosterFilter({ container, input, sorting });
        await Promise.resolve();
        expect(performanceMocks.loadPlayerPerformanceBatch).not.toHaveBeenCalled();

        input.value = 'north';
        input.dispatchEvent(new Event('input'));
        await vi.waitFor(() => expect(container.firstElementChild.hidden).toBe(false));
        expect(performanceMocks.loadPlayerPerformanceBatch).not.toHaveBeenCalled();

        sorting.value = 'performance';
        sorting.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(performanceMocks.loadPlayerPerformanceBatch)
            .toHaveBeenCalledWith(['#AAA']));
        cleanup();
    });

    it('orders the same free-roster cards by each supported sort key', async () => {
        const { initFreeRosterFilter } = await import('../../src/assets/js/cwl/cwl-roster-filter.js');
        const container = document.querySelector('#roster');
        const input = document.querySelector('#search');
        const sorting = document.createElement('select');
        sorting.innerHTML = `
            <option value="townhall">TH</option>
            <option value="name">Name</option>
            <option value="performance">Performance</option>
            <option value="reliability">Reliability</option>
            <option value="clan">Clan</option>`;
        const cards = [
            playerCard('Zulu', '#Z', { source: 'Bravo', townHall: 16 }),
            playerCard('Alpha', '#A', { source: 'Charlie', townHall: 17 }),
            playerCard('Mike', '#M', { source: 'Alpha', townHall: 17 })
        ];
        cards.forEach(card => {
            card._cwlPlayer = { clanName: card.dataset.source };
            container.append(card);
        });
        const performance = {
            '#Z': { performance: 96, reliability: 70 },
            '#A': { performance: 84, reliability: 95 },
            '#M': { performance: 96, reliability: 80 }
        };
        performanceMocks.getPlayerPerformance.mockImplementation(tag => performance[tag]);
        const cleanup = initFreeRosterFilter({ container, input, sorting });
        await vi.waitFor(() => expect(orderedTags(container)).toEqual(['#A', '#M', '#Z']));

        for (const [value, expected] of [
            ['name', ['#A', '#M', '#Z']],
            ['performance', ['#M', '#Z', '#A']],
            ['reliability', ['#A', '#M', '#Z']],
            ['clan', ['#M', '#Z', '#A']],
            ['townhall', ['#A', '#M', '#Z']]
        ]) {
            sorting.value = value;
            sorting.dispatchEvent(new Event('change'));
            await vi.waitFor(() => expect(orderedTags(container)).toEqual(expected));
        }
        cleanup();
    });
});

function orderedTags(container) {
    return [...container.children].map(card => card.dataset.playerTag);
}
