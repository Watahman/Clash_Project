const METRICS = {
    stars: {
        offense: item => item.summary.offense?.avgStars,
        defense: item => item.summary.defense?.avgStars,
        format: value => `${value.toFixed(2)}★`,
        axisFormat: value => `${compact(value)}★`,
        kind: 'stars',
        domain: [0, 3],
        ticks: [0, 1, 2, 3]
    },
    destruction: {
        offense: item => item.summary.offense?.avgDestruction,
        defense: item => item.summary.defense?.avgDestruction,
        format: value => `${value.toFixed(1)}%`,
        axisFormat: value => `${compact(value)}%`,
        kind: 'percent',
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100]
    },
    triples: {
        offense: item => rate(item.summary.offense?.tripleRate),
        defense: item => rate(item.summary.defense?.tripleRate),
        format: value => `${value.toFixed(1)}%`,
        axisFormat: value => `${compact(value)}%`,
        kind: 'percent',
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100]
    }
};

export function renderHistoricalTrendChart(container, seasons, metric = 'stars') {
    container.replaceChildren();
    const definition = METRICS[metric] || METRICS.stars;
    const points = seasons.map((item, index) => ({
        index,
        item,
        offense: finite(definition.offense(item)),
        defense: finite(definition.defense(item))
    }));
    const values = points.flatMap(point => [point.offense, point.defense])
        .filter(value => value != null);
    if (points.length < 2 || values.length < 2) {
        const empty = document.createElement('p');
        empty.className = 'op-history-empty';
        empty.textContent = 'Insufficient data for this trend.';
        container.appendChild(empty);
        return;
    }
    const width = 760;
    const height = 250;
    const padding = { top: 24, right: 24, bottom: 50, left: 46 };
    const scale = chartScale(definition, values);
    const [low, high] = scale.domain;
    const x = index => padding.left
        + index * (width - padding.left - padding.right)
            / Math.max(1, points.length - 1);
    const y = value => padding.top
        + (high - value) / (high - low)
            * (height - padding.top - padding.bottom);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute(
        'aria-label',
        'Offense and defense performance by CWL season'
    );
    svg.classList.add('op-history-trend-svg');
    svg.dataset.metric = metric;
    scale.ticks.forEach(value => {
        svg.append(
            line(padding.left, y(value), width - padding.right, y(value), 'grid'),
            text(padding.left - 8, y(value) + 4, definition.axisFormat(value), 'axis-value')
        );
    });
    svg.append(
        path(points, 'offense', x, y, 'offense'),
        path(points, 'defense', x, y, 'defense')
    );
    points.forEach(point => {
        if (point.offense != null) {
            svg.appendChild(dot(
                x(point.index), y(point.offense), 'offense',
                `${point.item.label}: ${definition.format(point.offense)} earned`
            ));
        }
        if (point.defense != null) {
            svg.appendChild(dot(
                x(point.index), y(point.defense), 'defense',
                `${point.item.label}: ${definition.format(point.defense)} conceded`
            ));
        }
        svg.appendChild(text(
            x(point.index),
            height - 18,
            shortLabel(point.item.data.season),
            'axis-season'
        ));
    });
    appendLatestValues(svg, points, definition, x, y);
    container.appendChild(svg);
}

function chartScale(definition, values) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min;
    if (definition.kind === 'stars'
            && min >= 1.5 && max <= 3 && spread >= 0.08) {
        let low = Math.floor(min * 2) / 2;
        let high = Math.ceil(max * 2) / 2;
        if (high - low < 1) {
            if (high + 0.5 <= 3) high += 0.5;
            else low -= 0.5;
        }
        const step = (high - low) / 4;
        return {
            domain: [low, high],
            ticks: Array.from(
                    { length: 5 },
                    (_, index) => low + step * index
            )
        };
    }
    if (definition.kind === 'percent' && spread >= 2) {
        if (min >= 50 && max <= 100) {
            return {
                domain: [50, 100],
                ticks: [50, 62.5, 75, 87.5, 100]
            };
        }
        if (min >= 25 && max <= 75) {
            return {
                domain: [25, 75],
                ticks: [25, 37.5, 50, 62.5, 75]
            };
        }
        if (min >= 0 && max <= 50) {
            return {
                domain: [0, 50],
                ticks: [0, 12.5, 25, 37.5, 50]
            };
        }
    }
    return {
        domain: definition.domain,
        ticks: definition.ticks
    };
}

function appendLatestValues(svg, points, definition, x, y) {
    ['offense', 'defense'].forEach((series, index) => {
        const point = [...points].reverse().find(item => item[series] != null);
        if (!point) return;
        const label = text(
                x(point.index) - 7,
                y(point[series]) + (index === 0 ? -9 : 16),
                definition.format(point[series]),
                'point-value'
        );
        label.dataset.series = series;
        svg.appendChild(label);
    });
}

function path(points, key, x, y, className) {
    const commands = [];
    let drawing = false;
    points.forEach(point => {
        if (point[key] == null) {
            drawing = false;
            return;
        }
        commands.push(
            `${drawing ? 'L' : 'M'} ${x(point.index)} ${y(point[key])}`
        );
        drawing = true;
    });
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    node.setAttribute('d', commands.join(' '));
    node.setAttribute('pathLength', '1');
    node.classList.add(`op-history-line-${className}`);
    return node;
}

function dot(x, y, className, label) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    node.setAttribute('cx', x);
    node.setAttribute('cy', y);
    node.setAttribute('r', 4);
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-label', label);
    node.classList.add(`op-history-dot-${className}`);
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = label;
    node.appendChild(title);
    return node;
}

function line(x1, y1, x2, y2, className) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    node.setAttribute('x1', x1);
    node.setAttribute('x2', x2);
    node.setAttribute('y1', y1);
    node.setAttribute('y2', y2);
    node.classList.add(`op-history-${className}`);
    return node;
}

function text(x, y, content, className) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    node.setAttribute('x', x);
    node.setAttribute('y', y);
    node.classList.add(`op-history-${className}`);
    node.textContent = content;
    return node;
}

function shortLabel(season) {
    const [year, month] = season.split('-').map(Number);
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
        month: 'short',
        timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function finite(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function rate(value) {
    return finite(value) == null ? null : Number(value) * 100;
}

function compact(value) {
    return Number.isInteger(value)
        ? value.toFixed(0)
        : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
