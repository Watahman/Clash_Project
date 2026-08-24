import { getCardTag } from './cwl-utils.js';
import { normalizeRosterStatus } from './cwl-plan-schema.js';
import { t } from '../i18n/i18n.js';
import { isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';

export function rememberPlannerPlayers() {
    if (isRedesignFixtureRequested()) return;
    const players = Array.from(
        document.querySelectorAll('.cwl-player-article[data-planner-card="true"]')
    ).map(player => ({
        name: player.querySelector('.cwl-player-name')?.textContent || '',
        clanName: player.querySelector('.cwl-player-clan')?.textContent || '',
        tag: getCardTag(player),
        townHall: Number(player.dataset.townHall || 1),
        rosterStatus: normalizeRosterStatus(player.dataset.rosterStatus)
    })).filter(player => player.tag);
    localStorage.setItem('clashtools_last_planner_players', JSON.stringify(players));
}

export function updateClanCapacityCounter(article) {
    const select = article.querySelector('.cwl-clan-capacity');
    const counter = article.querySelector('.cwl-amount-of-players-in-clan');
    if (!select || !counter) return;

    const players = Array.from(
        article.querySelectorAll('.cwl-clan-player-list .cwl-player-article[data-planner-card="true"]')
    );
    const capacity = Number(select.value || 15);
    const reserves = players.filter(player => (
        normalizeRosterStatus(player.dataset.rosterStatus, 'core') === 'reserve'
    )).length;
    const active = players.length - reserves;
    const capacityConflict = active > capacity;

    counter.textContent = reserves > 0
        ? `${active}/${capacity} · ${t(reserves === 1 ? 'cwl.reserveCountOne' : 'cwl.reserveCountMany', { count: reserves })}`
        : `${active}/${capacity}`;
    counter.title = t('cwl.rosterCounterTitle', {
        total: players.length,
        active,
        reserve: reserves,
        capacity
    });
    counter.dataset.totalPlayers = String(players.length);
    counter.dataset.activePlayers = String(active);
    counter.dataset.reservePlayers = String(reserves);
    counter.dataset.capacityConflict = String(capacityConflict);
    article.dataset.capacityConflict = String(capacityConflict);
    article.dataset.clanCapacity = String(capacity);
}

export function updateAllPlayerCounters() {
    const total = document.querySelector('#cwl-total-player-amount');
    if (total) {
        total.textContent = String(
            document.querySelectorAll(
                '#cwl-available-players .cwl-player-article[data-planner-card="true"]'
            ).length
        );
    }
    document.querySelectorAll('.cwl-clan-article').forEach(updateClanCapacityCounter);
}
