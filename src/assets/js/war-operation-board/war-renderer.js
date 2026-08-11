import { buildLiveView } from '../operation-board/operation-board-live-model.js';
import { buildWinCondition } from '../operation-board/operation-board-win-condition.js';
import { buildProjectedOutcome } from '../operation-board/operation-board-live-projection.js';
import { buildImportantAttacks } from '../operation-board/operation-board-live-recommendations.js';
import { escapeHtml, number } from '../operation-board/operation-board-utils.js';
import { normalizeWarState, parseClashTime } from '../cwl/cwl-war-state.js';
import {
    ASSET_FALLBACKS,
    getTownHallAsset,
    installImageFallback
} from '../assets/entity-assets.js';
import { buildWarContributions, attacksByOrder } from './war-contribution.js';
import { buildWarMap } from './war-map-model.js';
import { assignmentState } from './war-assignments.js';
import { buildMathematicalWarStatus } from './war-outcome-model.js';

export function renderScoreStrip(element, report) {
    const live = buildLiveView(report);
    const projection = buildProjectedOutcome(report, { simulations: 600 });
    const condition = buildWinCondition(report);
    const mathematical = buildMathematicalWarStatus(report);
    if (!live) {
        element.innerHTML = '';
        return;
    }
    element.innerHTML = `
        <div class="war-score-side war-score-own">
            ${badge(report.clan)}
            <span><strong>${escapeHtml(live.own.name)}</strong><small>${live.own.attacksUsed}/${live.own.availableAttacks} attacks</small></span>
        </div>
        <div class="war-score-main">
            <span>${stars(live.own.stars)} <b>—</b> ${stars(live.opponent.stars)}</span>
            <small>${percent(live.own.destruction)} — ${percent(live.opponent.destruction)}</small>
        </div>
        <div class="war-score-side war-score-opponent">
            <span><strong>${escapeHtml(live.opponent.name)}</strong><small>${live.opponent.attacksUsed}/${live.opponent.availableAttacks} attacks</small></span>
            ${badge(report.opponent)}
        </div>
        <div class="war-score-meta">
            <span class="war-state-pill is-${escapeHtml(live.state)}">${stateLabel(live.state)}</span>
            <span>${timeLabel(live)}</span>
            <span>Max: ${stars(condition?.maxFinalStars ?? live.own.stars)}</span>
            <span class="war-math-status is-${mathematical?.status || 'open'}">${mathLabel(mathematical?.status)}</span>
            <span>${projection?.winProbability == null ? 'Projection building' : `${projection.winProbability}% projected win`}</span>
        </div>`;
}

export function renderWarMap(element, report, sideName, selectedPosition, assignments) {
    const bases = buildWarMap(report, sideName);
    element.innerHTML = bases.map((base, index) => {
        const assignmentCount = sideName === 'enemy'
            ? assignments.filter(item => Number(item.targetPosition) === base.mapPosition).length
            : 0;
        return `<button class="war-base is-${base.state} ${base.mapPosition === selectedPosition ? 'is-selected' : ''}"
            type="button" data-base-position="${base.mapPosition}" style="--base-index:${index}">
            <span class="war-base-position">${base.mapPosition}</span>
            <span class="war-base-emblem"><img class="compete-townhall" src="${getTownHallAsset(base.townHall)}" alt="Town Hall ${base.townHall}"><i>${stars(base.stars)}</i></span>
            <span class="war-base-copy"><strong>${escapeHtml(base.name)}</strong><small>${percent(base.destruction)} · ${base.opponentAttacks} hit${base.opponentAttacks === 1 ? '' : 's'}</small></span>
            ${assignmentCount ? `<span class="war-base-assigned">${assignmentCount} assigned</span>` : ''}
        </button>`;
    }).join('');
    installAssetFallbacks(element);
}

export function renderBaseDetail(element, report, sideName, position, assignments) {
    const bases = buildWarMap(report, sideName);
    const base = bases.find(item => item.mapPosition === position) || bases[0];
    if (!base) {
        element.innerHTML = '<div class="war-detail-empty">Select a base to inspect it.</div>';
        return;
    }
    const recommendations = sideName === 'enemy'
        ? buildImportantAttacks(report, 6).filter(item => item.target.mapPosition === base.mapPosition)
        : [];
    const assigned = assignments.filter(item =>
        Number(item.targetPosition) === base.mapPosition
        || ['hold', 'free'].includes(item.type)
    );
    const roster = report.roster || [];
    element.innerHTML = `
        <header>
            <div><p>Base ${base.mapPosition}</p><h2>${escapeHtml(base.name)}</h2><span>${escapeHtml(base.tag)}</span></div>
            <span class="war-detail-th"><img class="compete-townhall" src="${getTownHallAsset(base.townHall)}" alt="Town Hall ${base.townHall}"> TH${base.townHall}</span>
        </header>
        <div class="war-detail-score"><strong>${stars(base.stars)}</strong><span>${percent(base.destruction)} best destruction</span></div>
        <section><h3>Attack history</h3>${base.attacks.length ? base.attacks.map(attack => `
            <div class="war-detail-row"><span>${escapeHtml(attack.attackerName)} · TH${attack.attackerTownHall}</span><strong>${stars(attack.stars)} · ${percent(attack.destructionPercentage)}</strong></div>`).join('') : '<p class="war-muted">No attacks on this base yet.</p>'}</section>
        ${sideName === 'enemy' ? `<section><h3>Assignments</h3>
            <div class="war-assignment-list">${assigned.length ? assigned.map(item => `
                <div class="war-assignment-item"><span>${escapeHtml(roster.find(player => player.tag === item.playerTag)?.name || item.playerTag)} · attack ${item.attackSlot} · ${assignmentLabel(item, base.mapPosition)}</span><em class="is-${assignmentState(item, report)}">${assignmentState(item, report)}</em><button type="button" data-remove-assignment="${item.id}" aria-label="Remove assignment">×</button></div>`).join('') : '<p class="war-muted">Nobody assigned yet.</p>'}</div>
            <form class="war-assignment-form" data-assignment-position="${base.mapPosition}">
                <select name="playerTag" required><option value="">Assign attacker…</option>${roster.map(player => `<option value="${player.tag}">${escapeHtml(player.name)}</option>`).join('')}</select>
                <select name="attackSlot"><option value="1">Attack 1</option><option value="2">Attack 2</option></select>
                <select name="type"><option value="base">Base ${base.mapPosition}</option><option value="cleanup">Cleanup ${base.mapPosition}</option><option value="hold">Hold</option><option value="free">Free attack</option></select>
                <button type="submit">Assign</button>
            </form></section>` : ''}
        ${recommendations.length ? `<section><h3>Recommended matchup</h3>${recommendations.slice(0, 2).map(item => `
            <div class="war-recommendation"><strong>${escapeHtml(item.attacker.name)}</strong><span>${item.expectedStars.toFixed(1)} stars expected · +${item.expectedNetStars.toFixed(1)} net</span><small>${reasonLabel(item.reason)} · ${item.confidence} confidence</small></div>`).join('')}</section>` : ''}`;
    installAssetFallbacks(element);
}

export function renderRoster(element, report, filter = 'all') {
    const rows = buildWarContributions(report);
    const limit = number(report.wars?.[0]?.attacksPerMember, 2);
    const attention = player => needsAttention(report, player, limit);
    const filtered = rows.filter(player => {
        if (filter === 'available') return player.attacksUsed < limit;
        if (filter === 'completed') return player.attacksUsed >= limit;
        if (filter === 'attention') return attention(player);
        return true;
    });
    element.innerHTML = filtered.map(player => `
        <article class="war-player-card cwl-player-article" data-performance-card="true"
            data-player-tag="${player.tag}" data-town-hall="${player.townHall}">
            <button class="war-player-main" type="button" data-performance-trigger>
                <span class="war-player-position">${player.mapPosition}</span>
                <span><strong class="cwl-player-name"><img class="compete-townhall" src="${getTownHallAsset(player.townHall)}" alt="Town Hall ${player.townHall}">${escapeHtml(player.name)}</strong><small>TH${player.townHall} · ${escapeHtml(player.tag)}</small></span>
            </button>
            <div class="war-player-metrics">
                <span><small>Attacks</small><strong>${player.attacksUsed}/${limit}</strong></span>
                <span><small>Stars</small><strong>${stars(player.stars)}</strong></span>
                <span><small>Net stars</small><strong>+${player.netStars}</strong></span>
                <span><small>Avg. destruction</small><strong>${player.avgDestruction == null ? '—' : percent(player.avgDestruction)}</strong></span>
            </div>
            <span class="war-player-status is-${attention(player) ? 'attention' : player.attacksUsed >= limit ? 'done' : player.attacksUsed ? 'active' : 'ready'}">${statusLabel(report, player, limit, attention(player))}</span>
        </article>`).join('') || '<p class="war-muted">No players match this filter.</p>';
    installAssetFallbacks(element);
}

export function renderStats(element, report) {
    const live = buildLiveView(report);
    const attacks = attacksByOrder(report);
    const recommendations = buildImportantAttacks(report, 3);
    const use = live?.own.availableAttacks
        ? live.own.attacksUsed / live.own.availableAttacks * 100
        : 0;
    const points = cumulativePoints(attacks);
    element.innerHTML = `
        <article class="war-stat-card"><p>Attack usage</p><strong>${Math.round(use)}%</strong><div class="war-progress"><i style="width:${use}%"></i></div><small>${live?.own.attacksUsed || 0} of ${live?.own.availableAttacks || 0} attacks used</small></article>
        <article class="war-stat-card war-chart-card"><p>Stars by attack order</p>${sparkline(points)}<small>${attacks.length ? `${attacks.length} recorded attacks` : 'Waiting for the first attack'}</small></article>
        <article class="war-stat-card"><p>Important next attacks</p>${recommendations.length ? recommendations.map(item => `<div class="war-mini-row"><span>${escapeHtml(item.attacker.name)} → #${item.target.mapPosition}</span><strong>${item.expectedNetStars.toFixed(1)} net stars</strong></div>`).join('') : '<small>No recommendation needed right now.</small>'}</article>`;
}

function cumulativePoints(attacks) {
    let total = 0;
    return attacks.map((attack, index) => {
        total += number(attack.netStars);
        return [index, total];
    });
}

function sparkline(points) {
    if (!points.length) return '<div class="war-chart-empty"></div>';
    const maxX = Math.max(1, points.length - 1);
    const maxY = Math.max(1, ...points.map(point => point[1]));
    const path = points.map(([x, y], index) =>
        `${index ? 'L' : 'M'} ${(x / maxX * 240).toFixed(1)} ${(64 - y / maxY * 52).toFixed(1)}`
    ).join(' ');
    return `<svg class="war-sparkline" viewBox="0 0 240 72" role="img" aria-label="Cumulative net stars by attack order"><path d="${path}"/></svg>`;
}

function badge(clan) {
    return clan?.badgeUrl
        ? `<img src="${escapeHtml(clan.badgeUrl)}" alt="${escapeHtml(clan.name || 'Clan')} badge" loading="lazy">`
        : `<img src="${ASSET_FALLBACKS.clan}" alt="Clan badge unavailable">`;
}

function stars(value) {
    return `${number(value)} stars`;
}

function percent(value) {
    return `${number(value).toFixed(1)}%`;
}

function stateLabel(state) {
    return ({ live: 'Live', preparation: 'Preparation', completed: 'Ended' })[state] || 'Unavailable';
}

function timeLabel(live) {
    const date = live.state === 'preparation' ? live.startTime : live.endTime;
    if (!date) return 'Time unavailable';
    const remaining = (parseClashTime(date)?.getTime() || 0) - Date.now();
    if (remaining <= 0) return live.state === 'completed' ? 'War ended' : 'Updating…';
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor(remaining % 3_600_000 / 60_000);
    return `${hours}h ${minutes}m remaining`;
}

function reasonLabel(reason) {
    return ({ highImpact: 'Highest net-star value', goodMatchup: 'Favorable matchup', bestAvailable: 'Best available matchup' })[reason] || 'Recommended';
}

function mathLabel(status) {
    return status === 'won'
        ? 'Mathematically won'
        : status === 'lost' ? 'Mathematically lost' : 'Outcome still open';
}

function assignmentLabel(assignment, position) {
    if (assignment.type === 'hold') return 'hold';
    if (assignment.type === 'free') return 'free';
    return assignment.type === 'cleanup'
        ? `cleanup #${position}`
        : `base #${position}`;
}

function installAssetFallbacks(element) {
    element.querySelectorAll('img.compete-townhall').forEach(image =>
        installImageFallback(image, ASSET_FALLBACKS.entity)
    );
    element.querySelectorAll('.war-score-side img').forEach(image =>
        installImageFallback(image, ASSET_FALLBACKS.clan)
    );
}

function statusLabel(report, player, limit, attention) {
    const ended = normalizeWarState(report?.wars?.[0]) === 'completed';
    if (ended && player.attacksUsed < limit) return 'Missed attacks';
    if (attention) return 'Needs attention';
    if (player.attacksUsed >= limit) return 'Done';
    return player.attacksUsed ? 'In progress' : 'Ready';
}

function needsAttention(report, player, limit) {
    const war = report?.wars?.[0];
    const state = normalizeWarState(war);
    if (state === 'completed') return player.attacksUsed < limit;
    if (state !== 'live') return false;
    const end = String(war?.endTime || '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
    if (!end) return false;
    const endTime = Date.UTC(
        Number(end[1]), Number(end[2]) - 1, Number(end[3]),
        Number(end[4]), Number(end[5]), Number(end[6])
    );
    return endTime - Date.now() <= 6 * 60 * 60 * 1000
        && player.attacksUsed < limit;
}
