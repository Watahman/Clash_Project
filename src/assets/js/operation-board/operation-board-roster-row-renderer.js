import { t } from '../i18n/i18n.js';
import {
    escapeHtml,
    number
} from './operation-board-utils.js';
import { badge } from './operation-board-render-utils.js';
import {
    ASSET_FALLBACKS,
    getTownHallAsset,
    installImageFallback
} from '../assets/entity-assets.js';

const PLAYER_STATUS_CLASSES = new Set([
    'apiOnly',
    'ok',
    'plannedOnly',
    'unplanned'
]);

export function renderPlayerRow(player, display, report, standalone) {
    const row = document.createElement('tr');
    const status = PLAYER_STATUS_CLASSES.has(player.status)
        ? player.status
        : 'unknown';
    const townHall = townHallLabel(player.townHall);
    row.className = `op-player-row op-status-${status}`;
    row.dataset.performanceCard = 'true';
    row.dataset.playerTag = player.tag;
    row.dataset.townHall = player.townHall || '';
    const planningCell = report.mode === 'historical'
        ? historicalParticipation(player, report.rounds?.length || 0)
        : standalone ? '' : `<td>${badge(
            player.planned ? t('op.planned') : t('op.notPlanned'),
            player.planned ? 'ok' : 'warn'
        )}</td>`;
    row.innerHTML = `
        <td><button type="button" class="op-player-info cwl-player-info"
                data-performance-trigger aria-expanded="false"
                aria-label="${escapeHtml(t('performance.openForPlayer', {
                    player: player.name
                }))}">
            <strong class="cwl-player-name">${escapeHtml(player.name)}</strong>
            <span>${escapeHtml(player.tag)}</span>
        </button></td>
        <td><img class="compete-townhall" src="${getTownHallAsset(player.townHall)}" alt="Town Hall ${escapeHtml(townHall)}"> TH${escapeHtml(townHall)}</td>
        ${planningCell}
        <td>${attackFraction(display.attacksUsed, display.availableAttacks)}</td>
        <td>${number(display.stars, 0)} stars</td>
        <td>${number(display.destruction, 0).toFixed(1)}%</td>
        <td>${report.mode === 'historical'
            ? defenseValue(display.avgDefense)
            : display.missed == null ? '—' : number(display.missed, 0)}</td>`;
    installImageFallback(
        row.querySelector('img.compete-townhall'),
        ASSET_FALLBACKS.entity
    );
    return row;
}

function attackFraction(used, available) {
    const availableValue = available == null ? '—' : number(available, 0);
    return `${number(used, 0)}/${availableValue}`;
}

function defenseValue(input) {
    const parsed = finite(input);
    return parsed == null ? '—' : `${parsed.toFixed(1)}%`;
}

function historicalParticipation(player, totalRounds) {
    const rounds = number(player.roundsPlayed, 0);
    const status = rounds === 0
        ? ['not-fielded', 'Not fielded']
        : player.missed == null
            ? ['unknown', 'Attack usage unknown']
            : number(player.missed, 0) > 0
                ? ['attention', 'Missed attacks']
                : ['complete', 'Complete'];
    return `<td><span class="op-history-participation" data-state="${status[0]}">
        <strong>${rounds}/${number(totalRounds, 0)}</strong>
        <small>${escapeHtml(status[1])}</small>
    </span></td>`;
}

function townHallLabel(value) {
    const parsed = number(value, 0);
    return parsed > 0 ? String(parsed) : 'unknown';
}

function finite(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
