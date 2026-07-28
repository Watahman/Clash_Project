const METRICS = {
    stars: {
        offense: item => item.summary.offense?.avgStars,
        defense: item => item.summary.defense?.avgStars,
        format: value => `${value.toFixed(2)}★`,
        axisFormat: value => `${value.toFixed(0)}★`,
        domain: [0, 3],
        ticks: [0, 1, 2, 3]
    },
    destruction: {
        offense: item => item.summary.offense?.avgDestruction,
        defense: item => item.summary.defense?.avgDestruction,
        format: value => `${value.toFixed(1)}%`,
        axisFormat: value => `${value.toFixed(0)}%`,
        domain: [0, 100],
        ticks: [0, 25, 50, 75, 100]
    },
    triples: {
        offense: item => rate(item.summary.offense?.tripleRate),
        defense: item => rate(item.summary.defense?.tripleRate),
        format: value => `${value.toFixed(1)}%`,
        axisFormat: value => `${value.toFixed(0)}%`,
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
    const [low, high] = definition.domain;
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
    definition.ticks.forEach(value => {
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
    container.appendChild(svg);
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
