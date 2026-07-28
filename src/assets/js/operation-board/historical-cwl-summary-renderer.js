import { formatSeason } from './historical-cwl-season-model.js';
import { escapeHtml } from './operation-board-utils.js';

export function renderHistoricalSummary(container, report) {
    const summary = report?.summary;
    if (!summary) {
        container.replaceChildren();
        return;
    }
    const leagueChange = summary.leagueChange || {
        state: 'unknown',
        nextLeague: null
    };
    const leagueLine = leagueTransition(summary.league, leagueChange);
    container.innerHTML = `
        <section class="op-history-season-head">
            <div>
                <p>${escapeHtml(formatSeason(summary.season).toUpperCase())}</p>
                <h2>${escapeHtml(leagueLine)}</h2>
                <span>${escapeHtml(finishLine(summary))}</span>
            </div>
            <span class="op-history-quality" data-quality="${qualityKey(summary.dataQuality)}">
                ${escapeHtml(summary.dataQuality)}
            </span>
        </section>
        <dl class="op-history-key-stats">
            ${metric('Avg. stars / war', stars(summary.offense.starsPerWar, 1))}
            ${metric('Avg. star differential', signed(summary.starDifferential, '★'))}
            ${metric('Attacks used', percent(summary.attackUsage))}
            ${metric('Missed attacks', value(summary.missedAttacks))}
        </dl>
        <section class="op-history-offense-defense" aria-label="Offense versus defense">
            <div class="op-history-side op-history-offense">
                <header><h3>Offense</h3><span>Earned by the clan</span></header>
                <dl>
                    ${metric('Stars / attack', stars(summary.offense.avgStars, 2))}
                    ${metric('Destruction / attack', percentValue(summary.offense.avgDestruction))}
                    ${metric('Triple rate', rate(summary.offense.tripleRate))}
                    ${metric('Stars / war', stars(summary.offense.starsPerWar, 1))}
                </dl>
            </div>
            <div class="op-history-side op-history-defense">
                <header><h3>Defense</h3><span>Conceded to opponents</span></header>
                ${summary.defense ? `<dl>
                    ${metric('Stars conceded / attack', stars(summary.defense.avgStars, 2))}
                    ${metric('Destruction conceded', percentValue(summary.defense.avgDestruction))}
                    ${metric('Tripled against', rate(summary.defense.tripleRate))}
                    ${metric('Stars conceded / war', stars(summary.defense.starsPerWar, 1))}
                </dl>` : `<p class="op-history-empty">Defense details are unavailable for this season.</p>`}
            </div>
        </section>
        <dl class="op-history-differentials">
            ${metric('Star differential / war', signed(summary.starDifferential, '★'))}
            ${metric('Destruction differential', signed(summary.destructionDifferential, '%'))}
        </dl>`;
}

export function clearHistoricalSummary(container) {
    container?.replaceChildren();
}

function leagueTransition(league, change) {
    const current = league?.name || 'League unknown';
    if (change?.state === 'same' || !change?.nextLeague?.name) return current;
    return `${current} → ${change.nextLeague.name}`;
}

function finishLine(summary) {
    const finish = summary.position ? `Finished #${summary.position}` : 'Final position unknown';
    const record = summary.record || {};
    return `${finish} · ${record.wins || 0}W · ${record.losses || 0}L · ${record.draws || 0}D`;
}

function metric(label, valueText) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(valueText)}</dd></div>`;
}

function stars(input, decimals) {
    return finite(input) == null ? '—' : `${Number(input).toFixed(decimals)}★`;
}

function rate(input) {
    return finite(input) == null ? '—' : `${(Number(input) * 100).toFixed(1)}%`;
}

function percent(input) {
    return finite(input) == null ? '—' : `${(Number(input) * 100).toFixed(1)}%`;
}

function percentValue(input) {
    return finite(input) == null ? '—' : `${Number(input).toFixed(1)}%`;
}

function value(input) {
    const parsed = finite(input);
    return parsed == null ? '—' : String(parsed);
}

function signed(input, suffix) {
    const parsed = finite(input);
    if (parsed == null) return '—';
    const sign = parsed > 0 ? '+' : '';
    return `${sign}${parsed.toFixed(1)}${suffix}`;
}

function finite(input) {
    if (input == null || input === '') return null;
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
}

function qualityKey(input) {
    return String(input || '').toLowerCase().replaceAll(' ', '-');
}
