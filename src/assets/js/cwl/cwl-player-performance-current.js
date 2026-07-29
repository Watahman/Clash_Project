import { t } from '../i18n/i18n.js';

export function renderCurrentCwlSection(context) {
    if (!context) return null;
    const section = document.createElement('div');
    section.className = 'cwl-performance-current';
    const heading = document.createElement('h3');
    heading.textContent = context.heading || (context.label
        ? `${context.label} CWL`
        : t('performance.currentCwl'));
    const rows = [
        [t('op.stars'), `${number(context.stars)}★`],
        [t('performance.avgDestruction'), `${number(context.avgDestruction, 1)}%`]
    ];
    if (context.missed != null) {
        rows.push([t('performance.missed'), nullableNumber(context.missed)]);
    }
    if (context.roundsPlayed != null) {
        rows.push([t('performance.roundsPlayed'), number(context.roundsPlayed)]);
    }
    if (context.attacksUsed != null) {
        rows.push([
            'Attacks',
            `${number(context.attacksUsed)} / ${number(context.attackLimit)}`
        ]);
    }
    if (context.avgStars != null) {
        rows.splice(2, 0, ['Avg. stars', `${number(context.avgStars, 2)}★`]);
    }
    if (context.tripleRate != null) {
        rows.push(['Triple rate', `${number(context.tripleRate * 100, 1)}%`]);
    }
    if (context.netStarsContributed != null) {
        rows.push([
            'Net stars contributed',
            `+${number(context.netStarsContributed)}`
        ]);
    }
    if (context.offensiveRank != null) {
        rows.push(['Offensive rank', `#${number(context.offensiveRank)}`]);
    }
    section.append(heading, metrics(rows));
    return section;
}

function metrics(rows) {
    const list = document.createElement('dl');
    list.className = 'cwl-performance-metrics';
    rows.forEach(([label, value]) => {
        const term = document.createElement('dt');
        const detail = document.createElement('dd');
        term.textContent = label;
        detail.textContent = value;
        list.append(term, detail);
    });
    return list;
}

function number(value, places = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(places) : '—';
}

function nullableNumber(value, places = 0) {
    return value == null ? '—' : number(value, places);
}
