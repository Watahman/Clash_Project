import { normalizeWarState } from './cwl-war-state.js';
import { t } from '../i18n/i18n.js';
import { buildWeightedPrediction } from './cwl-chart-prediction.js';

const DAY_COUNT = 7;
const SVG_NS = 'http://www.w3.org/2000/svg';

function normalizeTag(value = '') {
    const source = typeof value === 'object' && value !== null ? value.tag : value;
    const tag = String(source || '').trim().toUpperCase();
    if (!tag || tag === '#0' || tag === '0') return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

function unique(values) {
    return new Set(values).size === values.length;
}

function emptyHistoryPoint(day, reason = 'incomplete') {
    return { day, rank: null, clanCount: null, stars: null, destruction: null, reason };
}

function buildRankingHistory({ leagueGroup, leagueWars = [], selectedClanTag = '', buildStandings }) {
    const rounds = Array.isArray(leagueGroup?.rounds) ? leagueGroup.rounds : [];
    const clanTags = Array.isArray(leagueGroup?.clans)
        ? leagueGroup.clans.map(normalizeTag).filter(Boolean)
        : [];
    const groupIsValid = clanTags.length >= 2 && clanTags.length % 2 === 0 && unique(clanTags);
    const expectedWarsPerRound = groupIsValid ? clanTags.length / 2 : 0;
    const selectedTag = normalizeTag(selectedClanTag);
    let cumulativeWars = [];
    let sequenceComplete = groupIsValid && selectedTag && clanTags.includes(selectedTag) && typeof buildStandings === 'function';

    return Array.from({ length: DAY_COUNT }, (_, index) => {
        const day = index + 1;
        if (!sequenceComplete) return emptyHistoryPoint(day, groupIsValid ? 'previousIncomplete' : 'missingLeagueGroup');

        const expectedRaw = Array.isArray(rounds[index]?.warTags) ? rounds[index].warTags : [];
        const expectedTags = expectedRaw.map(normalizeTag).filter(Boolean);
        const roundShapeIsComplete = expectedRaw.length === expectedWarsPerRound
            && expectedTags.length === expectedWarsPerRound
            && unique(expectedTags);
        if (!roundShapeIsComplete) {
            sequenceComplete = false;
            return emptyHistoryPoint(day, 'missingWarTags');
        }

        const warsByTag = new Map(
            leagueWars
                .filter(war => Number(war?._round) === day)
                .map(war => [normalizeTag(war?._warTag), war])
                .filter(([tag]) => tag)
        );
        const dayWars = expectedTags.map(tag => warsByTag.get(tag));
        const warsAreCompleted = dayWars.every(war => war
            && war.clan
            && war.opponent
            && normalizeWarState(war) === 'completed');
        const coveredClans = new Set(dayWars.flatMap(war => war
            ? [normalizeTag(war.clan), normalizeTag(war.opponent)]
            : []).filter(Boolean));
        const coversWholeGroup = coveredClans.size === clanTags.length
            && clanTags.every(tag => coveredClans.has(tag));
        if (!warsAreCompleted || !coversWholeGroup) {
            sequenceComplete = false;
            return emptyHistoryPoint(day, warsAreCompleted ? 'incompleteClanCoverage' : 'unfinishedWars');
        }

        cumulativeWars = cumulativeWars.concat(dayWars);
        const standings = buildStandings(cumulativeWars, selectedTag);
        const selected = standings?.rows?.[standings.selectedIndex];
        if (!selected || standings.rows.length !== clanTags.length) {
            sequenceComplete = false;
            return emptyHistoryPoint(day, 'invalidStandings');
        }

        return {
            day,
            rank: Number(selected.rank),
            clanCount: standings.rows.length,
            stars: Number(selected.stars) || 0,
            destruction: Number(selected.destruction) || 0,
            reason: 'complete'
        };
    });
}

function getLineSegments(history) {
    const segments = [];
    let active = [];
    history.forEach(point => {
        if (point.rank == null) {
            if (active.length) segments.push(active);
            active = [];
            return;
        }
        active.push(point);
    });
    if (active.length) segments.push(active);
    return segments;
}

function renderRankingHistoryChart(container, history = [], status) {
    if (!container) return;
    const normalized = Array.from({ length: DAY_COUNT }, (_, index) => history[index] || emptyHistoryPoint(index + 1));
    const available = normalized.filter(point => point.rank != null);
    const clanCount = Math.max(2, ...available.map(point => Number(point.clanCount) || 0));
    const prediction = buildWeightedPrediction(normalized, 'rank', { minimum: 1, maximum: clanCount });
    const xForDay = day => ((day - 1) / (DAY_COUNT - 1)) * 100;
    const yForRank = rank => ((rank - 1) / (clanCount - 1)) * 100;

    container.replaceChildren();
    container.dataset.state = available.length ? 'ready' : 'empty';
    container.setAttribute('aria-label', t('op.positionChartLabel'));
    if (status) status.textContent = t('op.chartDaysAvailable', { count: available.length, total: DAY_COUNT });

    const visual = document.createElement('div');
    visual.className = 'op-stars-chart-visual';
    const yAxis = document.createElement('div');
    yAxis.className = 'op-stars-y-axis';
    yAxis.setAttribute('aria-hidden', 'true');
    [1, Math.ceil(clanCount / 2), clanCount].forEach(rank => {
        const label = document.createElement('span');
        label.textContent = `#${rank}`;
        yAxis.appendChild(label);
    });

    const plot = document.createElement('div');
    plot.className = 'op-stars-plot';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('op-stars-svg');
    [0, 50, 100].forEach(y => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('x2', '100');
        line.setAttribute('y1', String(y));
        line.setAttribute('y2', String(y));
        line.classList.add('op-stars-grid-line');
        svg.appendChild(line);
    });
    getLineSegments(normalized).forEach(segment => {
        if (segment.length < 2) return;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', segment.map((point, index) => `${index ? 'L' : 'M'} ${xForDay(point.day)} ${yForRank(point.rank)}`).join(' '));
        path.classList.add('op-stars-line', 'op-ranking-line');
        svg.appendChild(path);
    });
    if (prediction.length > 1) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', prediction.map((point, index) => `${index ? 'L' : 'M'} ${xForDay(point.day)} ${yForRank(point.value)}`).join(' '));
        path.classList.add('op-stars-line', 'op-prediction-line', 'op-ranking-prediction-line');
        svg.appendChild(path);
    }
    plot.appendChild(svg);

    available.forEach(point => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'op-stars-point op-ranking-point';
        button.dataset.day = String(point.day);
        button.style.setProperty('--point-x', `${xForDay(point.day)}%`);
        button.style.setProperty('--point-y', `${yForRank(point.rank)}%`);
        button.setAttribute('aria-label', t('op.positionChartPoint', {
            day: point.day,
            rank: point.rank,
            total: point.clanCount,
            stars: point.stars,
            destruction: point.destruction.toFixed(1)
        }));

        const dot = document.createElement('span');
        dot.className = 'op-stars-point-dot';
        dot.setAttribute('aria-hidden', 'true');
        const tooltip = document.createElement('span');
        tooltip.className = 'op-stars-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        const title = document.createElement('strong');
        title.textContent = `${t('op.day')} ${point.day} · #${point.rank}/${point.clanCount}`;
        const stars = document.createElement('span');
        stars.textContent = t('op.chartCumulativeStars', { stars: point.stars });
        const destruction = document.createElement('span');
        destruction.textContent = `${point.destruction.toFixed(1)}% ${t('op.destruction')}`;
        tooltip.append(title, stars, destruction);
        button.append(dot, tooltip);
        button.addEventListener('click', () => button.classList.toggle('is-open'));
        button.addEventListener('blur', () => button.classList.remove('is-open'));
        button.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                button.classList.remove('is-open');
                button.blur();
            }
        });
        plot.appendChild(button);
    });

    if (!available.length) {
        const empty = document.createElement('p');
        empty.className = 'op-stars-chart-empty';
        empty.textContent = t('op.positionChartEmpty');
        plot.appendChild(empty);
    }
    visual.append(yAxis, plot);

    const xAxisRow = document.createElement('div');
    xAxisRow.className = 'op-stars-x-axis-row';
    const spacer = document.createElement('span');
    spacer.setAttribute('aria-hidden', 'true');
    const xAxis = document.createElement('div');
    xAxis.className = 'op-stars-x-axis';
    normalized.forEach(point => {
        const label = document.createElement('span');
        label.setAttribute('aria-label', point.rank == null
            ? t('op.positionDayEmpty', { day: point.day })
            : t('op.positionDayValue', { day: point.day, rank: point.rank, total: point.clanCount }));
        const day = document.createElement('small');
        day.textContent = `${t('op.dayShort')}${point.day}`;
        const value = document.createElement('strong');
        value.textContent = point.rank == null ? '—' : `#${point.rank}`;
        label.append(day, value);
        xAxis.appendChild(label);
    });
    xAxisRow.append(spacer, xAxis);

    const summary = document.createElement('p');
    summary.className = 'sr-only';
    summary.textContent = normalized.map(point => point.rank == null
        ? t('op.positionDayEmpty', { day: point.day })
        : t('op.positionChartPoint', {
            day: point.day,
            rank: point.rank,
            total: point.clanCount,
            stars: point.stars,
            destruction: point.destruction.toFixed(1)
        })).join(' ');
    const legend = document.createElement('div');
    legend.className = 'op-chart-legend op-ranking-chart-legend';
    legend.hidden = prediction.length < 2;
    legend.innerHTML = `
        <span><i class="op-chart-legend-actual" aria-hidden="true"></i>${t('op.chartActual')}</span>
        <span><i class="op-chart-legend-prediction" aria-hidden="true"></i>${t('op.chartPrediction')}</span>`;
    container.append(visual, xAxisRow, legend, summary);
}

export { buildRankingHistory, getLineSegments, renderRankingHistoryChart };
