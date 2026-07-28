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
    if (!refs.rosterPlanningHeader) return;
    refs.rosterPlanningHeader.hidden = standalone && !historical;
    refs.rosterPlanningHeader.textContent = historical
        ? 'Participation'
        : t('op.planning');
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
    });

    refs.rosterCount.textContent = `${roster.length} ${t('op.players')}`;
    if (!roster.length) {
        renderEmptyRoster(refs, selectedClan, report);
        return;
    }
    roster.forEach(player => {
        const display = day
            ? getPlayerDayDisplay(player, day)
            : {
                attacksUsed: player.attacksUsed,
                availableAttacks: player.availableAttacks,
                stars: player.stars,
                destruction: player.destruction,
                missed: player.missed
            };
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
            missed: stat.missed
        }
        : {
            attacksUsed: 0,
            availableAttacks: 0,
            stars: 0,
            destruction: 0,
            missed: 0
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
        <td>${display.missed == null ? '—' : number(display.missed, 0)}</td>`;
    return row;
}

function attackFraction(used, available) {
    const availableValue = available == null ? '—' : number(available, 0);
    return `${number(used, 0)}/${availableValue}`;
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
