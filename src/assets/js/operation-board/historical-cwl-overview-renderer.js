import { renderHistoricalComparison } from './historical-cwl-comparison-renderer.js';
import { renderHistoricalTrendChart } from './historical-cwl-trend-chart.js';
import { escapeHtml } from './operation-board-utils.js';

export function renderHistoricalOverview(
    container,
    overview,
    { selectSeason } = {}
) {
    if (!overview?.seasons?.length) {
        container.innerHTML = `
            <section class="op-flat-section op-history-empty-state">
                <h2>No CWL history available</h2>
                <p>ClashKing has no completed CWL seasons for this clan.</p>
            </section>`;
        return;
    }
    container.innerHTML = `
        <section class="op-history-overview-head">
            <div>
                <h2>${overview.count} season${overview.count === 1 ? '' : 's'}</h2>
                <p>${overview.promotions} promotions · ${overview.relegations} relegations · ${averageFinish(overview)}</p>
            </div>
            <span>Completed CWL seasons</span>
        </section>
        <section class="op-flat-section op-history-progression">
            ${heading('League progression', 'League and final position per season')}
            <div class="op-history-timeline">
                ${overview.chronological.map(timelineItem).join('')}
            </div>
        </section>
        <section class="op-flat-section op-history-trends">
            <div class="op-section-heading op-history-trend-heading">
                <div><p>Performance trends</p><h2>Offense vs defense</h2></div>
                <div class="op-history-trend-toggle" role="group" aria-label="Trend metric">
                    <button type="button" data-trend="stars" aria-pressed="true">Stars</button>
                    <button type="button" data-trend="destruction" aria-pressed="false">Destruction</button>
                    <button type="button" data-trend="triples" aria-pressed="false">Triple rate</button>
                </div>
            </div>
            <div class="op-history-chart-legend">
                <span data-series="offense">Earned</span>
                <span data-series="defense">Conceded</span>
            </div>
            <div class="op-history-trend-chart"></div>
        </section>
        <section class="op-flat-section op-history-performance">
            ${heading('Season performance', 'Record, reliability and average differentials')}
            <div class="op-history-performance-list">
                ${overview.seasons.map(performanceItem).join('')}
            </div>
        </section>
        ${overview.insights.length ? `
            <section class="op-flat-section op-history-insights">
                ${heading('Season insights', 'Notable facts from complete metrics')}
                <div>${overview.insights.map(insightItem).join('')}</div>
            </section>` : ''}
        <section class="op-flat-section op-history-compare">
            ${heading('Compare seasons', 'The right-hand season is compared with the left')}
            <div class="op-history-compare-content"></div>
        </section>`;
    bindSeasonButtons(container, selectSeason);
    const chart = container.querySelector('.op-history-trend-chart');
    const trendButtons = Array.from(container.querySelectorAll('[data-trend]'));
    const renderTrend = metric => {
        trendButtons.forEach(button =>
            button.setAttribute('aria-pressed', String(button.dataset.trend === metric))
        );
        chart.dataset.trend = metric;
        renderHistoricalTrendChart(chart, overview.chronological, metric);
    };
    trendButtons.forEach(button => {
        button.onclick = () => renderTrend(button.dataset.trend);
    });
    renderTrend('stars');
    renderHistoricalComparison(
        container.querySelector('.op-history-compare-content'),
        overview.seasons
    );
}

export function clearHistoricalOverview(container) {
    container?.replaceChildren();
}

function heading(title, description) {
    return `<div class="op-section-heading">
        <div><p>${escapeHtml(description)}</p><h2>${escapeHtml(title)}</h2></div>
    </div>`;
}

function timelineItem(item) {
    return `<button type="button" data-history-season="${item.data.season}">
        <span>${escapeHtml(shortSeason(item.data.season))}</span>
        <strong>${escapeHtml(item.summary.league?.name || 'League unavailable')}</strong>
        <em>${item.summary.position ? `#${item.summary.position}` : '—'}</em>
        <small data-change="${item.change}">${escapeHtml(changeLabel(item.change))}</small>
    </button>`;
}

function performanceItem(item) {
    const summary = item.summary;
    const usage = summary.attackUsage == null
        ? 'Usage unknown'
        : `${(summary.attackUsage * 100).toFixed(0)}% used`;
    const misses = summary.missedAttacks == null
        ? 'misses unknown'
        : `${summary.missedAttacks} missed`;
    const reliabilityTone = summary.attackUsage == null || summary.missedAttacks == null
        ? 'neutral'
        : summary.attackUsage >= 0.95 && summary.missedAttacks === 0
            ? 'complete'
            : 'attention';
    const league = summary.league?.name || 'League unavailable';
    const position = summary.position ? `#${summary.position}` : '—';
    const starsPerWar = summary.offense.starsPerWar == null
        ? '—'
        : `${summary.offense.starsPerWar.toFixed(1)}★ / war`;
    return `<button type="button" data-history-season="${item.data.season}">
        <span class="op-history-performance-season">
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(league)} · ${position} · ${escapeHtml(changeLabel(item.change))}</small>
        </span>
        ${recordMarkup(summary.record)}
        <span class="op-history-performance-reliability" data-tone="${reliabilityTone}">${usage} · ${misses}</span>
        <span>${escapeHtml(starsPerWar)}</span>
        <small class="op-history-performance-diff">${signed(summary.starDifferential, '★')} · ${signed(summary.destructionDifferential, '%')}</small>
    </button>`;
}

function insightItem(insight) {
    return `<article data-insight="${escapeHtml(insight.type || 'neutral')}">
        <span>${escapeHtml(insight.title)}</span>
        <strong>${escapeHtml(insight.season)}</strong>
        <em>${escapeHtml(insight.value)}</em>
    </article>`;
}

function recordMarkup(record = {}) {
    return `<span class="op-history-record">
        <b data-result="win">${record.wins || 0}W</b>
        <b data-result="loss">${record.losses || 0}L</b>
        <b data-result="draw">${record.draws || 0}D</b>
    </span>`;
}

function bindSeasonButtons(container, selectSeason) {
    container.querySelectorAll('[data-history-season]').forEach(button => {
        button.onclick = () => selectSeason?.(button.dataset.historySeason);
    });
}

function averageFinish(overview) {
    return overview.averageFinish == null
        ? 'Average finish unknown'
        : `Average finish #${overview.averageFinish.toFixed(1)}`;
}

function signed(value, suffix) {
    if (!Number.isFinite(value)) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}${suffix}`;
}

function changeLabel(change) {
    if (change === 'promoted') return '↑ Promoted';
    if (change === 'relegated') return '↓ Relegated';
    if (change === 'same') return 'No league change';
    return 'Change unknown';
}

function shortSeason(season) {
    const [year, month] = season.split('-').map(Number);
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}
