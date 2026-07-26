import { t } from '../i18n/i18n.js';

export function renderCurrentCwlSection(context) {
    if (!context) return null;
    const section = document.createElement('div');
    section.className = 'cwl-performance-current';
    const heading = document.createElement('h3');
    heading.textContent = t('performance.currentCwl');
    section.append(heading, metrics([
        [
            t('performance.attacksUsed'),
            `${number(context.attacksUsed)} / ${number(context.availableAttacks)}`
        ],
        [t('op.stars'), `${number(context.stars)}★`],
        [t('performance.avgDestruction'), `${number(context.avgDestruction, 1)}%`],
        [t('performance.missed'), number(context.missed)],
        [t('performance.roundsPlayed'), number(context.roundsPlayed)]
    ]));
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
