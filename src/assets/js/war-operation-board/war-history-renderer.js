import { escapeHtml, number } from '../operation-board/operation-board-utils.js';

export function renderWarHistory(summaryElement, listElement, history) {
    const summary = history?.summary || {};
    summaryElement.innerHTML = `
        ${metric('Win rate', summary.winRate == null ? '—' : `${number(summary.winRate).toFixed(0)}%`)}
        ${metric('Record', `${number(summary.wins)}W · ${number(summary.losses)}L · ${number(summary.draws)}D`)}
        ${metric('Avg. stars', summary.avgStars == null ? '—' : number(summary.avgStars).toFixed(1))}
        ${metric('Avg. attack use', summary.avgUsage == null ? '—' : `${number(summary.avgUsage).toFixed(0)}%`)}`;
    const wars = history?.wars || [];
    listElement.innerHTML = wars.length ? wars.map(war => `
        <article class="war-history-row is-${war.result}">
            <span class="war-history-result">${war.result === 'win' ? 'W' : war.result === 'loss' ? 'L' : 'D'}</span>
            <span><strong>${escapeHtml(war.opponent.name)}</strong><small>${dateLabel(war.endTime)} · ${war.teamSize}v${war.teamSize}</small></span>
            <span><strong>${war.own.stars}★ — ${war.opponent.stars}★</strong><small>${war.own.destruction.toFixed(1)}% — ${war.opponent.destruction.toFixed(1)}%</small></span>
            <span><strong>${war.attackUsage.toFixed(0)}%</strong><small>attack usage</small></span>
        </article>`).join('') : '<p class="war-muted">No public regular-war history is available for this clan.</p>';
}

function metric(label, value) {
    return `<article><small>${label}</small><strong>${value}</strong></article>`;
}

function dateLabel(value) {
    if (!value) return 'Date unavailable';
    const compact = String(value).match(/^(\d{4})(\d{2})(\d{2})T/);
    const date = compact
        ? new Date(`${compact[1]}-${compact[2]}-${compact[3]}T00:00:00Z`)
        : new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Date unavailable'
        : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
