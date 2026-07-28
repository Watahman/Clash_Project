export function compareHistoricalSeasons(left, right) {
    if (!left || !right) return [];
    return [
        textRow('League', left.league?.name, right.league?.name),
        numberRow('Position', left.position, right.position, {
            decimals: 0,
            prefix: '#',
            lowerIsBetter: true
        }),
        numberRow(
            'Stars / attack',
            left.offense?.avgStars,
            right.offense?.avgStars,
            { decimals: 2, suffix: '★' }
        ),
        numberRow(
            'Destruction',
            left.offense?.avgDestruction,
            right.offense?.avgDestruction,
            { decimals: 1, suffix: '%' }
        ),
        numberRow(
            'Triple rate',
            percent(left.offense?.tripleRate),
            percent(right.offense?.tripleRate),
            { decimals: 1, suffix: '%' }
        ),
        numberRow(
            'Stars conceded',
            left.defense?.avgStars,
            right.defense?.avgStars,
            { decimals: 2, suffix: '★', lowerIsBetter: true }
        ),
        numberRow(
            'Attack usage',
            percent(left.attackUsage),
            percent(right.attackUsage),
            { decimals: 1, suffix: '%' }
        ),
        numberRow(
            'Missed attacks',
            left.missedAttacks,
            right.missedAttacks,
            { decimals: 0, lowerIsBetter: true }
        )
    ].filter(row => row.left !== '—' || row.right !== '—');
}

function textRow(label, left, right) {
    return {
        label,
        left: left || '—',
        right: right || '—',
        change: '',
        direction: 'neutral'
    };
}

function numberRow(label, left, right, options = {}) {
    const leftNumber = finite(left);
    const rightNumber = finite(right);
    const change = leftNumber == null || rightNumber == null
        ? null
        : rightNumber - leftNumber;
    const direction = change == null || Math.abs(change) < 0.0001
        ? 'neutral'
        : (options.lowerIsBetter ? change < 0 : change > 0)
            ? 'good'
            : 'bad';
    return {
        label,
        left: format(leftNumber, options),
        right: format(rightNumber, options),
        change: formatChange(change, options),
        direction
    };
}

function format(value, { decimals = 1, prefix = '', suffix = '' } = {}) {
    return value == null ? '—' : `${prefix}${value.toFixed(decimals)}${suffix}`;
}

function formatChange(value, { decimals = 1, suffix = '' } = {}) {
    if (value == null) return '—';
    if (Math.abs(value) < 0.0001) return '→ 0';
    const arrow = value > 0 ? '↑' : '↓';
    return `${arrow}${Math.abs(value).toFixed(decimals)}${suffix}`;
}

function percent(value) {
    return finite(value) == null ? null : Number(value) * 100;
}

function finite(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
