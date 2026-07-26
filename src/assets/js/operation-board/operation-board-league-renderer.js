import { renderRankingHistoryChart } from '../cwl/cwl-ranking-history.js';
import { renderStarsPerDayChart } from '../cwl/cwl-stars-chart.js';
import { isAttackCountingState } from '../cwl/cwl-war-state.js';
import { t } from '../i18n/i18n.js';
import {
    escapeHtml,
    number
} from './operation-board-utils.js';
import {
    chip,
    resultText,
    stateText
} from './operation-board-render-utils.js';

export function renderLeagueSections(refs, report) {
    refs.starsChart.setAttribute(
        'aria-busy',
        String(report.predictionState === 'loading')
    );
    const countedRounds = report.rounds.filter(round =>
        isAttackCountingState(round.state)
    );
    refs.roundState.textContent = countedRounds.length
        ? `${countedRounds.length} ${t('op.roundsShort')}`
        : t('op.noPlayedRounds');
    refs.roundCount.textContent = `${report.rounds.length} ${t('op.roundsShort')}`;
    renderRounds(refs, report.rounds, report.predictionState);
    renderStarsPerDayChart(refs.starsChart, report.rounds, refs.starsChartState);
    renderRankingHistoryChart(
        refs.positionChart,
        report.rankingHistory,
        refs.positionChartState
    );
    renderScoreboard(refs, report);
    renderStandings(refs, report);
}

export function clearLeagueSections(refs) {
    refs.totalStars.textContent = '0';
    refs.avgDestruction.textContent = '0%';
    refs.attacksUsed.textContent = '0/0';
    refs.missed.textContent = '0';
    refs.currentPosition.textContent = '-';
    refs.starsChart.setAttribute('aria-busy', 'false');
    refs.thList.replaceChildren();
    renderStarsPerDayChart(refs.starsChart, [], refs.starsChartState);
    renderRankingHistoryChart(refs.positionChart, [], refs.positionChartState);
    refs.roundsList.replaceChildren();
    refs.standingsList.replaceChildren();
    refs.standingsState.textContent = '-';
    refs.standingsNote.textContent = '';
}

function renderScoreboard(refs, report) {
    const countedRounds = report.rounds.filter(round =>
        isAttackCountingState(round.state)
    );
    const totalStars = countedRounds.reduce(
        (sum, round) => sum + number(round.stars, 0),
        0
    );
    const averageDestruction = countedRounds.length
        ? countedRounds.reduce(
            (sum, round) => sum + number(round.destruction, 0),
            0
        ) / countedRounds.length
        : 0;
    const attacksUsed = report.roster.reduce(
        (sum, player) => sum + number(player.attacksUsed, 0),
        0
    );
    const available = report.roster.reduce(
        (sum, player) => sum + number(player.availableAttacks, 0),
        0
    );
    const missed = report.roster.reduce(
        (sum, player) => sum + number(player.missed, 0),
        0
    );
    refs.totalStars.textContent = totalStars;
    refs.avgDestruction.textContent = `${averageDestruction.toFixed(1)}%`;
    refs.attacksUsed.textContent = `${attacksUsed}/${available}`;
    refs.missed.textContent = missed;

    const distribution = report.roster.reduce((result, player) => {
        if (player.townHall) {
            result[player.townHall] = (result[player.townHall] || 0) + 1;
        }
        return result;
    }, {});
    refs.thList.replaceChildren();
    Object.entries(distribution)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .forEach(([townHall, amount]) => {
            const item = document.createElement('span');
            item.textContent = `TH${townHall}: ${amount}`;
            refs.thList.appendChild(item);
        });
    if (!Object.keys(distribution).length) {
        refs.thList.appendChild(chip(t('op.noRoster')));
    }
}

function renderStandings(refs, report) {
    refs.standingsList.replaceChildren();
    refs.standingsNote.textContent = '';
    const standings = report?.standings;
    if (!standings?.rows?.length || standings.selectedIndex < 0) {
        refs.standingsState.textContent = t('op.standingsUnavailable');
        refs.currentPosition.textContent = '-';
        refs.standingsList.appendChild(chip(t('op.standingsFallback')));
        return;
    }
    const selected = standings.rows[standings.selectedIndex];
    refs.standingsState.textContent = `#${selected.rank}/${standings.rows.length}`;
    refs.currentPosition.textContent = `#${selected.rank}`;
    standings.rows.forEach(row => {
        const item = document.createElement('div');
        item.className = `op-standing-row${row.tag === selected.tag ? ' is-selected' : ''}`;
        item.innerHTML = `
            <span class="op-standing-rank">#${row.rank}</span>
            <strong>${escapeHtml(row.name)}</strong>
            <span>${number(row.stars, 0)}★</span>
            <span>${number(row.destruction, 0).toFixed(1)}%</span>`;
        refs.standingsList.appendChild(item);
    });
    refs.standingsNote.textContent = t('op.standingsNote', {
        count: standings.completedWars
    });
}

function renderRounds(refs, rounds, predictionState = 'idle') {
    refs.roundsList.replaceChildren();
    rounds.forEach(round => {
        const card = document.createElement('article');
        card.className = `op-round-card op-round-${round.result} op-round-state-${round.state}`;
        card.setAttribute(
            'aria-label',
            `${t('op.day')} ${round.day}: ${resultText(round.result)}`
        );
        card.innerHTML = `
            <div class="op-round-title">
                <strong>${t('op.day')} ${round.day}</strong>
                <span class="op-status-pill" data-state="${escapeHtml(round.state)}">${escapeHtml(stateText(round.state))}</span>
            </div>
            <p class="op-round-opponent-name">${escapeHtml(round.opponent || '-')}</p>
            <div class="op-round-stats">
                <span><strong>${number(round.stars, 0)}</strong>${t('op.stars')}</span>
                <span><strong>${number(round.destruction, 0).toFixed(1)}%</strong>Dest</span>
                <span><strong>${number(round.attacksUsed, 0)}/${number(round.availableAttacks, 0)}</strong>Atk</span>
            </div>
            ${predictionMarkup(round, predictionState)}`;
        refs.roundsList.appendChild(card);
    });
}

function predictionMarkup(round, predictionState) {
    const prediction = round.prediction;
    if (prediction) {
        const maximumStars = number(prediction.availableAttacks, 0) * 3;
        return `
            <div class="op-round-prediction" data-state="ready">
                <span class="op-round-prediction-label">${escapeHtml(t('op.chartPrediction'))}</span>
                <div class="op-bonus-performance op-prediction-performance">
                    <span title="${escapeHtml(t('op.predictedStars'))}"><strong>${number(prediction.stars, 0).toFixed(2)}/${maximumStars}</strong><small>${escapeHtml(t('op.stars'))}</small></span>
                    <span title="${escapeHtml(t('op.predictedDestruction'))}"><strong>${number(prediction.destruction, 0).toFixed(2)}%</strong><small>Dest</small></span>
                    <span title="${escapeHtml(t('op.predictedAttacks'))}"><strong>${number(prediction.attacksUsed, 0).toFixed(2)}/${number(prediction.availableAttacks, 0)}</strong><small>${escapeHtml(t('op.attacks'))}</small></span>
                </div>
            </div>`;
    }
    const loading = predictionState === 'loading';
    return `
        <div class="op-round-prediction" data-state="${loading ? 'loading' : 'unavailable'}">
            <span class="op-round-prediction-label">${escapeHtml(t('op.chartPrediction'))}</span>
            <span class="op-prediction-state">${escapeHtml(t(loading ? 'op.predictionLoading' : 'op.predictionUnavailable'))}</span>
        </div>`;
}
