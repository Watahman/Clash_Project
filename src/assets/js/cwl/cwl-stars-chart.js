import { isAttackCountingState } from './cwl-war-state.js';
import { t } from '../i18n/i18n.js';
import { buildWeightedPrediction } from './cwl-chart-prediction.js';

const DAY_COUNT = 7;
const SVG_NS = 'http://www.w3.org/2000/svg';

function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function buildStarsPerDaySeries(rounds = []) {
    const byDay = new Map();
    rounds.forEach(round => {
        const day = Math.trunc(safeNumber(round?.day, 0));
        if (day >= 1 && day <= DAY_COUNT) byDay.set(day, round);
    });

    return Array.from({ length: DAY_COUNT }, (_, index) => {
        const day = index + 1;
        const round = byDay.get(day);
        const hasData = Boolean(round && isAttackCountingState(round.state));
        return {
            day,
            state: round?.state || 'notAvailable',
            stars: hasData ? Math.max(0, safeNumber(round.stars, 0)) : null,
            predictedStars: Number.isFinite(Number(round?.prediction?.stars))
                ? Math.max(0, Number(round.prediction.stars))
                : null,
            destruction: hasData ? Math.max(0, safeNumber(round.destruction, 0)) : null,
            opponent: hasData ? String(round.opponent || '-').trim() || '-' : null
        };
    });
}

function buildPredictionSeries(series) {
    const actual = series.filter(point => point.stars != null);
    const lastActual = actual.at(-1);
    const future = series
        .filter(point => point.stars == null && point.predictedStars != null && (!lastActual || point.day > lastActual.day))
        .map(point => ({ day: point.day, value: point.predictedStars }));
    if (!future.length) return [];
    return lastActual ? [{ day: lastActual.day, value: lastActual.stars }, ...future] : future;
}

function getStarsScaleMaximum(series) {
    const highest = Math.max(0, ...series.map(point => point.stars ?? 0));
    if (highest <= 3) return 3;
    return Math.ceil(highest / 5) * 5;
}

function getLineSegments(series) {
    const segments = [];
    let active = [];
    series.forEach(point => {
        if (point.stars == null) {
            if (active.length) segments.push(active);
            active = [];
            return;
        }
        active.push(point);
    });
    if (active.length) segments.push(active);
    return segments;
}

function formatAxisNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function renderStarsPerDayChart(container, rounds = [], status) {
    if (!container) return;
    const series = buildStarsPerDaySeries(rounds);
    const played = series.filter(point => point.stars != null);
    const difficultyPrediction = buildPredictionSeries(series);
    const prediction = difficultyPrediction.length
        ? difficultyPrediction
        : buildWeightedPrediction(series, 'stars', { minimum: 0 });
    const maximum = getStarsScaleMaximum([
        ...series,
        ...prediction.map(point => ({ stars: point.value }))
    ]);
    const xForDay = day => ((day - 1) / (DAY_COUNT - 1)) * 100;
    const yForStars = stars => 100 - (stars / maximum) * 100;

    container.replaceChildren();
    container.dataset.state = played.length ? 'ready' : 'empty';
    container.setAttribute('aria-label', t('op.starsChartLabel'));
    if (status) status.textContent = t('op.chartDaysAvailable', { count: played.length, total: DAY_COUNT });

    const visual = document.createElement('div');
    visual.className = 'op-stars-chart-visual';

    const yAxis = document.createElement('div');
    yAxis.className = 'op-stars-y-axis';
    yAxis.setAttribute('aria-hidden', 'true');
    [maximum, maximum / 2, 0].forEach(value => {
        const label = document.createElement('span');
        label.textContent = formatAxisNumber(value);
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

    getLineSegments(series).forEach(segment => {
        if (segment.length < 2) return;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', segment.map((point, index) => `${index ? 'L' : 'M'} ${xForDay(point.day)} ${yForStars(point.stars)}`).join(' '));
        path.classList.add('op-stars-line');
        svg.appendChild(path);
    });
    if (prediction.length > 1) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', prediction.map((point, index) => `${index ? 'L' : 'M'} ${xForDay(point.day)} ${yForStars(point.value)}`).join(' '));
        path.classList.add('op-stars-line', 'op-prediction-line');
        svg.appendChild(path);
    }
    plot.appendChild(svg);

    played.forEach(point => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'op-stars-point';
        button.dataset.day = String(point.day);
        button.style.setProperty('--point-x', `${xForDay(point.day)}%`);
        button.style.setProperty('--point-y', `${yForStars(point.stars)}%`);
        button.setAttribute('aria-label', t('op.starsChartPoint', {
            day: point.day,
            stars: point.stars,
            destruction: point.destruction.toFixed(1),
            opponent: point.opponent
        }));

        const dot = document.createElement('span');
        dot.className = 'op-stars-point-dot';
        dot.setAttribute('aria-hidden', 'true');

        const tooltip = document.createElement('span');
        tooltip.className = 'op-stars-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        const title = document.createElement('strong');
        title.textContent = `${t('op.day')} ${point.day} · ${point.stars}★`;
        const destruction = document.createElement('span');
        destruction.textContent = `${point.destruction.toFixed(1)}% ${t('op.destruction')}`;
        const opponent = document.createElement('span');
        opponent.textContent = t('op.chartOpponent', { opponent: point.opponent });
        tooltip.append(title, destruction, opponent);
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

    if (!played.length) {
        const empty = document.createElement('p');
        empty.className = 'op-stars-chart-empty';
        empty.textContent = t('op.starsChartEmpty');
        plot.appendChild(empty);
    }

    visual.append(yAxis, plot);

    const xAxisRow = document.createElement('div');
    xAxisRow.className = 'op-stars-x-axis-row';
    const spacer = document.createElement('span');
    spacer.setAttribute('aria-hidden', 'true');
    const xAxis = document.createElement('div');
    xAxis.className = 'op-stars-x-axis';
    series.forEach(point => {
        const label = document.createElement('span');
        label.setAttribute('aria-label', point.stars == null
            ? t('op.chartDayEmpty', { day: point.day })
            : t('op.chartDayValue', { day: point.day, stars: point.stars }));
        const day = document.createElement('small');
        day.textContent = `${t('op.dayShort')}${point.day}`;
        const value = document.createElement('strong');
        value.textContent = point.stars == null ? '—' : `${point.stars}★`;
        label.append(day, value);
        xAxis.appendChild(label);
    });
    xAxisRow.append(spacer, xAxis);

    const summary = document.createElement('p');
    summary.className = 'sr-only';
    summary.textContent = series.map(point => point.stars == null
        ? t('op.chartDayEmpty', { day: point.day })
        : t('op.starsChartPoint', {
            day: point.day,
            stars: point.stars,
            destruction: point.destruction.toFixed(1),
            opponent: point.opponent
        })).join(' ');

    const legend = createChartLegend(prediction.length > 1);
    container.append(visual, xAxisRow, legend, summary);
}

function createChartLegend(showPrediction) {
    const legend = document.createElement('div');
    legend.className = 'op-chart-legend';
    legend.hidden = !showPrediction;
    legend.innerHTML = `
        <span><i class="op-chart-legend-actual" aria-hidden="true"></i>${t('op.chartActual')}</span>
        <span><i class="op-chart-legend-prediction" aria-hidden="true"></i>${t('op.chartPrediction')}</span>`;
    return legend;
}

export { buildStarsPerDaySeries, getLineSegments, getStarsScaleMaximum, renderStarsPerDayChart };
