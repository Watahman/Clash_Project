import { t } from '../i18n/i18n.js';
import {
    escapeHtml,
    lower,
    number
} from './operation-board-utils.js';
import {
    badge,
    option,
    stateText
} from './operation-board-render-utils.js';
import { matchesRosterView } from './operation-board-roster-filter.js';

export function isStandaloneMode(report, selectedClan = null) {
    return Boolean(
        report?.mode === 'historical'
        || report?.clan?.standalone
        || (!report && selectedClan?.standalone)
    );
}

export function syncRosterMode(refs, report, selectedClan = null) {
    const historical = report?.mode === 'historical';
    const standalone = isStandaloneMode(report, selectedClan);
    if (refs.rosterPlanningHeader) {
        refs.rosterPlanningHeader.hidden = standalone && !historical;
        const label = refs.rosterPlanningHeader.querySelector(
            '[data-op-roster-column-label]'
        );
        if (label) {
            label.textContent = historical ? 'Participation' : t('op.planning');
        } else {
            refs.rosterPlanningHeader.textContent = historical
                ? 'Participation'
                : t('op.planning');
        }
    }
    const defenseHeader = refs.rosterDefenseHeader
        || refs.rosterBody?.closest('table')
            ?.querySelector('[data-op-roster-column="defense"]');
    if (defenseHeader) {
        const label = defenseHeader.querySelector(
            '[data-op-roster-defense-label]'
        );
        if (label) {
            label.textContent = historical ? 'Average defense' : t('op.missed');
        }
        defenseHeader.dataset.opRosterSort = historical ? 'defense' : 'missed';
        const table = defenseHeader.closest('table');
        if (historical && table?.dataset.rosterSortKey === 'missed') {
            table.dataset.rosterSortKey = 'defense';
        } else if (!historical && table?.dataset.rosterSortKey === 'defense') {
            table.dataset.rosterSortKey = 'missed';
        }
    }
}

export function renderRosterViewOptions(refs, report, selectedClan = null) {
    const current = refs.rosterView.value || 'all';
    const standalone = isStandaloneMode(report, selectedClan);
    const baseOptions = standalone
        ? [
            option('all', t('op.viewAll')),
            option('missed', t('op.viewMissed')),
            option('attention', t('op.viewAttention'))
        ]
        : [
            option('all', t('op.viewAll')),
            option('planned', t('op.viewPlanned')),
            option('unplanned', t('op.viewUnplanned')),
            option('missed', t('op.viewMissed')),
            option('attention', t('op.viewAttention'))
        ];
    refs.rosterView.replaceChildren(...baseOptions);
    const rounds = (report?.rounds || []).filter(round =>
        round.state !== 'notStarted'
        || round.opponent !== '-'
        || number(round.availableAttacks, 0) > 0
    );
    rounds.forEach((round, index) => {
        if (index === 0) {
            refs.rosterView.appendChild(option('', '──────────', { disabled: true }));
        }
        refs.rosterView.appendChild(option(
            `day:${round.day}`,
            `${t('op.day')} ${round.day} · ${stateText(round.state)}`
        ));
    });
    refs.rosterView.value = Array.from(refs.rosterView.options)
        .some(item => item.value === current)
        ? current
        : 'all';
}

export function renderRoster(refs, report, selectedClan = null) {
    refs.rosterBody.replaceChildren();
    syncRosterSortHeaders(refs, report, selectedClan);
    if (!report) {
        renderEmptyRoster(refs, selectedClan);
        return;
    }
    const query = lower(refs.rosterFilter.value);
    const view = refs.rosterView.value;
    const day = view.startsWith('day:') ? number(view.split(':')[1], 0) : 0;
    const roster = report.roster.filter(player => {
        const matchesSearch = !query
            || lower(player.name).includes(query)
            || lower(player.tag).includes(query);
        return matchesSearch && matchesRosterView(player, view);
    }).map(player => ({
        player,
        display: day
            ? getPlayerDayDisplay(player, day)
            : {
                attacksUsed: player.attacksUsed,
                availableAttacks: player.availableAttacks,
                stars: player.stars,
                destruction: player.destruction,
                missed: player.missed,
                avgDefense: player.avgDefense
            }
    }));
    sortRoster(roster, refs);

    refs.rosterCount.textContent = `${roster.length} ${t('op.players')}`;
    if (!roster.length) {
        renderEmptyRoster(refs, selectedClan, report);
        return;
    }
    roster.forEach(({ player, display }) => {
        refs.rosterBody.appendChild(renderPlayerRow(player, display, report));
    });
}

export function renderEmptyRoster(refs, selectedClan = null, report = null) {
    if (refs.rosterBody.children.length) return;
    const row = document.createElement('tr');
    row.className = 'op-table-empty';
    const cell = document.createElement('td');
    cell.colSpan = report?.mode === 'historical'
        ? 7
        : isStandaloneMode(report, selectedClan) ? 6 : 7;
    cell.textContent = t('op.noRoster');
    row.appendChild(cell);
    refs.rosterBody.appendChild(row);
}

function getPlayerDayDisplay(player, day) {
    const stat = player.dayStats?.[day];
    return stat
        ? {
            attacksUsed: stat.attacksUsed,
            availableAttacks: stat.availableAttacks,
            stars: stat.stars,
            destruction: stat.destruction,
            missed: stat.missed,
            avgDefense: stat.avgDefense
        }
        : {
            attacksUsed: 0,
            availableAttacks: 0,
            stars: 0,
            destruction: 0,
            missed: 0,
            avgDefense: null
        };
}

function renderPlayerRow(player, display, report) {
    const row = document.createElement('tr');
    row.className = `op-player-row op-status-${player.status}`;
    row.dataset.performanceCard = 'true';
    row.dataset.playerTag = player.tag;
    row.dataset.townHall = player.townHall || '';
    const standalone = isStandaloneMode(report);
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
        <td>TH${player.townHall || '-'}</td>
        ${planningCell}
        <td>${attackFraction(display.attacksUsed, display.availableAttacks)}</td>
        <td>${number(display.stars, 0)}★</td>
        <td>${number(display.destruction, 0).toFixed(1)}%</td>
        <td>${report.mode === 'historical'
            ? defenseValue(display.avgDefense)
            : display.missed == null ? '—' : number(display.missed, 0)}</td>`;
    return row;
}

function attackFraction(used, available) {
    const availableValue = available == null ? '—' : number(available, 0);
    return `${number(used, 0)}/${availableValue}`;
}

function defenseValue(input) {
    const parsed = finite(input);
    return parsed == null ? '—' : `${parsed.toFixed(2)}★`;
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
        <small>${status[1]}</small>
    </span></td>`;
}

function syncRosterSortHeaders(refs, report, selectedClan) {
    const table = refs.rosterBody.closest('table');
    if (!table) return;
    const headers = Array.from(table.querySelectorAll('[data-op-roster-sort]'));
    const activeKey = table.dataset.rosterSortKey || '';
    const activeDirection = table.dataset.rosterSortDirection || '';
    headers.forEach(header => {
        const button = header.querySelector('.op-table-sort');
        const indicator = header.querySelector('.op-sort-indicator');
        const active = header.dataset.opRosterSort === activeKey;
        header.setAttribute(
            'aria-sort',
            active
                ? activeDirection === 'asc' ? 'ascending' : 'descending'
                : 'none'
        );
        if (indicator) {
            indicator.textContent = active
                ? activeDirection === 'asc' ? '↑' : '↓'
                : '↕';
        }
        if (!button) return;
        button.disabled = !report;
        button.onclick = report ? () => {
            const key = header.dataset.opRosterSort;
            const currentKey = table.dataset.rosterSortKey;
            const currentDirection = table.dataset.rosterSortDirection;
            table.dataset.rosterSortKey = key;
            table.dataset.rosterSortDirection = currentKey === key
                ? currentDirection === 'desc' ? 'asc' : 'desc'
                : key === 'player' ? 'asc' : 'desc';
            renderRoster(refs, report, selectedClan);
        } : null;
    });
}

function sortRoster(rows, refs) {
    const table = refs.rosterBody.closest('table');
    const key = table?.dataset.rosterSortKey;
    const direction = table?.dataset.rosterSortDirection;
    if (!key || !['asc', 'desc'].includes(direction)) return;
    const multiplier = direction === 'asc' ? 1 : -1;
    rows.sort((left, right) => {
        const first = rosterSortValue(left, key);
        const second = rosterSortValue(right, key);
        if (first == null && second != null) return 1;
        if (first != null && second == null) return -1;
        let result = 0;
        if (typeof first === 'string' || typeof second === 'string') {
            result = String(first).localeCompare(String(second), undefined, {
                sensitivity: 'base'
            });
        } else {
            result = number(first, 0) - number(second, 0);
        }
        return result * multiplier
            || left.player.name.localeCompare(right.player.name);
    });
}

function rosterSortValue(row, key) {
    const { player, display } = row;
    if (key === 'player') return player.name;
    if (key === 'townHall') return finite(player.townHall);
    if (key === 'participation') return finite(player.roundsPlayed)
        ?? (player.planned ? 1 : 0);
    if (key === 'attacks') return finite(display.attacksUsed);
    if (key === 'stars') return finite(display.stars);
    if (key === 'destruction') return finite(display.destruction);
    if (key === 'defense') return finite(display.avgDefense);
    if (key === 'missed') return finite(display.missed);
    return null;
}

function finite(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
