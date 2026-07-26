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

export function isStandaloneMode(report, selectedClan = null) {
    return Boolean(report?.clan?.standalone || (!report && selectedClan?.standalone));
}

export function syncRosterMode(refs, report, selectedClan = null) {
    const standalone = isStandaloneMode(report, selectedClan);
    if (refs.rosterPlanningHeader) refs.rosterPlanningHeader.hidden = standalone;
    if (refs.rosterWarHeader) refs.rosterWarHeader.hidden = standalone;
}

export function renderRosterViewOptions(refs, report, selectedClan = null) {
    const current = refs.rosterView.value || 'all';
    const standalone = isStandaloneMode(report, selectedClan);
    const baseOptions = standalone
        ? [
            option('all', t('op.viewAll')),
            option('missed', t('op.viewMissed'))
        ]
        : [
            option('all', t('op.viewAll')),
            option('planned', t('op.viewPlanned')),
            option('unplanned', t('op.viewUnplanned')),
            option('missed', t('op.viewMissed'))
        ];
    refs.rosterView.replaceChildren(...baseOptions);
    (report?.rounds || []).forEach((round, index) => {
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
        if (!matchesSearch) return false;
        if (view === 'planned') return player.planned;
        if (view === 'unplanned') {
            return player.status === 'unplanned' || player.status === 'apiOnly';
        }
        if (view === 'missed') return number(player.missed, 0) > 0;
        return true;
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
                warText: player.warParticipant ? t('op.inAnyWar') : t('op.notInWar'),
                warKind: player.warParticipant ? 'ok' : 'muted',
                attacksUsed: player.attacksUsed,
                availableAttacks: player.availableAttacks,
                stars: player.stars,
                destruction: player.destruction
            };
        refs.rosterBody.appendChild(renderPlayerRow(player, display, report));
    });
}

export function renderEmptyRoster(refs, selectedClan = null, report = null) {
    if (refs.rosterBody.children.length) return;
    const row = document.createElement('tr');
    row.className = 'op-table-empty';
    const cell = document.createElement('td');
    cell.colSpan = isStandaloneMode(report, selectedClan) ? 5 : 7;
    cell.textContent = t('op.noRoster');
    row.appendChild(cell);
    refs.rosterBody.appendChild(row);
}

function getPlayerDayDisplay(player, day) {
    const stat = player.dayStats?.[day];
    return stat
        ? {
            warText: stat.warParticipant ? t('op.inThisWar') : t('op.notInThisWar'),
            warKind: stat.warParticipant ? 'ok' : 'muted',
            attacksUsed: stat.attacksUsed,
            availableAttacks: stat.availableAttacks,
            stars: stat.stars,
            destruction: stat.destruction
        }
        : {
            warText: t('op.notInThisWar'),
            warKind: 'muted',
            attacksUsed: 0,
            availableAttacks: 0,
            stars: 0,
            destruction: 0
        };
}

function renderPlayerRow(player, display, report) {
    const row = document.createElement('tr');
    row.className = `op-player-row op-status-${player.status}`;
    const standalone = isStandaloneMode(report);
    const planningCell = standalone
        ? ''
        : `<td>${badge(
            player.planned ? t('op.planned') : t('op.notPlanned'),
            player.planned ? 'ok' : 'warn'
        )}</td>`;
    const warCell = standalone
        ? ''
        : `<td>${badge(display.warText, display.warKind)}</td>`;
    row.innerHTML = `
        <td><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.tag)}</span></td>
        <td>TH${player.townHall || '-'}</td>
        ${planningCell}
        ${warCell}
        <td>${number(display.attacksUsed, 0)}/${number(display.availableAttacks, 0)}</td>
        <td>${number(display.stars, 0)}★</td>
        <td>${number(display.destruction, 0).toFixed(1)}%</td>`;
    return row;
}
