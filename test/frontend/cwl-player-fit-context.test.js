import { describe, expect, it } from 'vitest';

describe('CWL player fit context', () => {
    it('reports the current clan fit for an assigned player', async () => {
        const { getPlayerFitContext } = await import(
            '../../src/assets/js/cwl/cwl-player-fit-context.js'
        );
        const root = document.createElement('main');
        root.innerHTML = `
            <article class="cwl-clan-article" id="cwl-clan-template_alpha"
                     data-clan-tag="#ALPHA" data-clan-name="Alpha"
                     data-clan-league="Master League I">
                <select class="cwl-clan-capacity"><option selected value="15">15</option></select>
                <div class="cwl-clan-player-list">
                    <article class="cwl-player-article" data-planner-card="true"
                             data-player-tag="#P1" data-town-hall="17"></article>
                </div>
            </article>`;
        const card = root.querySelector('[data-player-tag="#P1"]');
        const context = getPlayerFitContext(card, readyPerformance(), root);

        expect(context.mode).toBe('assigned');
        expect(context.fits).toHaveLength(1);
        expect(context.fits[0]).toMatchObject({ clanId: 'alpha', clanName: 'Alpha' });
        expect(Number.isFinite(context.fits[0].fit)).toBe(true);
    });

    it('returns at most three best fits for a free-roster player in descending order', async () => {
        const { getPlayerFitContext } = await import(
            '../../src/assets/js/cwl/cwl-player-fit-context.js'
        );
        const root = document.createElement('main');
        root.innerHTML = `
            <div id="cwl-available-players">
                <article class="cwl-player-article" data-planner-card="true"
                         data-player-tag="#P1" data-town-hall="17"></article>
            </div>
            ${clanCard('alpha', 'Alpha', 'Master League I')}
            ${clanCard('bravo', 'Bravo', 'Crystal League I')}
            ${clanCard('charlie', 'Charlie', 'Gold League I')}
            ${clanCard('delta', 'Delta', 'Bronze League I')}`;
        const card = root.querySelector('[data-player-tag="#P1"]');
        const context = getPlayerFitContext(card, readyPerformance(), root);

        expect(context.mode).toBe('free');
        expect(context.fits).toHaveLength(3);
        expect(context.fits.map(item => item.clanId)).not.toContain('delta');
        expect(context.fits[0].fit).toBeGreaterThanOrEqual(context.fits[1].fit);
        expect(context.fits[1].fit).toBeGreaterThanOrEqual(context.fits[2].fit);
        expect(new Set(context.fits.map(item => item.clanId)).size).toBe(3);
    });

    it('does not expose a planner fit for a card outside the planner roster', async () => {
        const { getPlayerFitContext } = await import(
            '../../src/assets/js/cwl/cwl-player-fit-context.js'
        );
        const card = document.createElement('article');
        card.className = 'cwl-player-article';
        card.dataset.playerTag = '#P1';
        expect(getPlayerFitContext(card, readyPerformance(), document)).toBeNull();
    });
});

function readyPerformance() {
    return {
        status: 'ready',
        performance: 92,
        reliability: 88,
        confidence: 'High',
        attackCount: 20,
        avgStars: 2.4,
        sameThCount: 12,
        upHitCount: 5,
        scope: 'CWL'
    };
}

function clanCard(id, name, league) {
    return `<article class="cwl-clan-article" id="cwl-clan-template_${id}"
        data-clan-tag="#${id.toUpperCase()}" data-clan-name="${name}"
        data-clan-league="${league}">
        <select class="cwl-clan-capacity"><option selected value="15">15</option></select>
    </article>`;
}
