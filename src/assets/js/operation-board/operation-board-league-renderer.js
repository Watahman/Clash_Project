import { renderRankingHistoryChart } from '../cwl/cwl-ranking-history.js';
import { renderStarsPerDayChart } from '../cwl/cwl-stars-chart.js';
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
import { buildLeagueModel } from './operation-board-league-model.js';

export function renderLeagueSections(refs, report) {
    const league = buildLeagueModel(report);
    const historical = report.mode === 'historical';
    if (refs.finishMetric) refs.finishMetric.hidden = historical;
    if (refs.positionLabel) {
        refs.positionLabel.textContent = historical
            ? 'Final position'
            : t('op.currentPosition');
    }
    if (refs.starsChartNote) {
        refs.starsChartNote.textContent = historical
            ? 'Only completed war days from ClashKing history are shown.'
            : t('op.starsChartHelp');
    }
    if (refs.positionChartNote) {
        refs.positionChartNote.textContent = historical
            ? 'Daily positions are shown only when historical snapshots exist.'
            : t('op.positionChartHelp');
    }
    if (refs.positionChartPanel) {
        refs.positionChartPanel.hidden = historical
            && !(report.rankingHistory || []).length;
    }
    refs.starsChart.setAttribute(
        'aria-busy',
        String(report.predictionState === 'loading')
    );
    refs.roundState.textContent = league.completedRounds
        ? `${league.completedRounds} ${t('op.roundsShort')}`
        : t('op.noPlayedRounds');
    refs.roundCount.textContent = `${report.rounds.length} ${t('op.roundsShort')}`;
    renderRounds(refs, report.rounds, report.predictionState);
    renderStarsPerDayChart(refs.starsChart, report.rounds, refs.starsChartState);
    renderRankingHistoryChart(
        refs.positionChart,
        report.rankingHistory,
        refs.positionChartState,
        league.forecast.history
    );
    renderLeagueMetrics(refs, league);
    renderStandings(refs, report);
}

export function clearLeagueSections(refs) {
    if (refs.finishMetric) refs.finishMetric.hidden = false;
    if (refs.positionChartPanel) refs.positionChartPanel.hidden = false;
    if (refs.positionLabel) refs.positionLabel.textContent = t('op.currentPosition');
    if (refs.starsChartNote) refs.starsChartNote.textContent = t('op.starsChartHelp');
    if (refs.positionChartNote) refs.positionChartNote.textContent = t('op.positionChartHelp');
    refs.currentPosition.textContent = '-';
    refs.projectedFinish.textContent = '-';
    refs.completedRounds.textContent = '0/7';
    refs.record.textContent = '0W · 0L';
    refs.finishProbabilities.textContent = '';
    refs.finishProbabilities.hidden = true;
    refs.starsChart.setAttribute('aria-busy', 'false');
    renderStarsPerDayChart(refs.starsChart, [], refs.starsChartState);
    renderRankingHistoryChart(refs.positionChart, [], refs.positionChartState);
    refs.roundsList.replaceChildren();
    refs.standingsList.replaceChildren();
    refs.standingsState.textContent = '-';
    refs.standingsNote.textContent = '';
}

function renderLeagueMetrics(refs, league) {
    refs.completedRounds.textContent =
        `${league.completedRounds}/${league.totalRounds}`;
    refs.record.textContent = formatRecord(league.record);
    refs.projectedFinish.textContent = league.forecast.available
        ? formatProjectedFinish(league.forecast)
        : '—';
    refs.finishProbabilities.replaceChildren();
    refs.finishProbabilities.hidden = !league.forecast.probabilities.length;
    compactProbabilities(league.forecast.probabilities)
        .filter(item => item.probability >= 0.01)
        .forEach(item => {
            const value = document.createElement('span');
            value.textContent =
                `${item.label} ${Math.round(item.probability * 100)}%`;
            refs.finishProbabilities.appendChild(value);
        });
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
    const header = document.createElement('div');
    header.className = 'op-standing-row op-standing-header';
    header.innerHTML = `
        <span>${escapeHtml(t('op.rank'))}</span>
        <strong>${escapeHtml(t('op.clan'))}</strong>
        <span>${escapeHtml(t('op.wins'))}</span>
        <span>${escapeHtml(t('op.stars'))}</span>
        <span>${escapeHtml(t('op.destruction'))}</span>`;
    refs.standingsList.appendChild(header);
    standings.rows.forEach(row => {
        const item = document.createElement('div');
        item.className = `op-standing-row${row.tag === selected.tag ? ' is-selected' : ''}`;
        item.innerHTML = `
            <span class="op-standing-rank">#${row.rank}</span>
            <strong>${escapeHtml(row.name)}</strong>
            <span>${number(row.wins, 0)}W</span>
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
        card.innerHTML = round.historical
            ? historicalRoundMarkup(round)
            : `
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
            ${round.state === 'completed'
                ? `<p class="op-result-text">${escapeHtml(resultText(round.result))}</p>`
                : ''}
            ${predictionMarkup(round, predictionState)}`;
        refs.roundsList.appendChild(card);
    });
}

function historicalRoundMarkup(round) {
    const available = Number.isFinite(Number(round.availableAttacks))
        ? `${number(round.attacksUsed, 0)}/${number(round.availableAttacks, 0)}`
        : `${number(round.attacksUsed, 0)}/—`;
    return `
        <div class="op-round-title">
            <strong>${t('op.day')} ${round.day}</strong>
            <span class="op-result-text">${escapeHtml(resultText(round.result))}</span>
        </div>
        <p class="op-round-opponent-name">${escapeHtml(round.opponent || '-')}</p>
        <p class="op-history-round-score">
            <strong>${number(round.stars, 0)}–${number(round.starsConceded, 0)}</strong>
            <span>earned – conceded</span>
        </p>
        <div class="op-round-stats">
            <span><strong>${number(round.destruction, 0).toFixed(1)}%</strong>Earned</span>
            <span><strong>${number(round.destructionConceded, 0).toFixed(1)}%</strong>Conceded</span>
            <span><strong>${available}</strong>Atk</span>
        </div>`;
}

function predictionMarkup(round, predictionState) {
    const prediction = round.prediction;
    if (round.state === 'completed') return '';
    if (prediction && prediction.confidence !== 'Low') {
        const confidence = t(`performance.confidence${prediction.confidence}`);
        return `
            <details class="op-round-prediction" data-state="ready">
                <summary>${escapeHtml(t('op.expectedCompact', {
                    stars: number(prediction.stars, 0).toFixed(1),
                    confidence
                }))}</summary>
                <p>${escapeHtml(t('op.predictionExplanation', {
                    destruction: number(prediction.destruction, 0).toFixed(1),
                    attacks: number(prediction.attacksUsed, 0).toFixed(1),
                    available: number(prediction.availableAttacks, 0),
                    coverage: Math.round(number(prediction.coverage, 0) * 100)
                }))}</p>
            </details>`;
    }
    const loading = predictionState === 'loading';
    return `
        <div class="op-round-prediction" data-state="${loading ? 'loading' : 'unavailable'}">
            <span class="op-round-prediction-label">${escapeHtml(t('op.chartPrediction'))}</span>
            <span class="op-prediction-state">${escapeHtml(t(loading ? 'op.predictionLoading' : 'op.predictionUnavailable'))}</span>
        </div>`;
}

function formatRecord(record) {
    const draw = record.draws ? ` · ${record.draws}D` : '';
    return `${record.wins}W · ${record.losses}L${draw}`;
}

function formatProjectedFinish(forecast) {
    return forecast.minimum === forecast.maximum
        ? `#${forecast.minimum}`
        : `#${forecast.minimum}–#${forecast.maximum}`;
}

function compactProbabilities(probabilities) {
    const top = probabilities
        .filter(item => item.rank <= 3)
        .map(item => ({ ...item, label: `#${item.rank}` }));
    const lower = probabilities
        .filter(item => item.rank >= 4)
        .reduce((sum, item) => sum + item.probability, 0);
    return lower ? [...top, { label: '#4+', probability: lower }] : top;
}
