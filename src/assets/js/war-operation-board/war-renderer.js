import { buildLiveView } from '../operation-board/operation-board-live-model.js';
import { buildWinCondition } from '../operation-board/operation-board-win-condition.js';
import { buildProjectedOutcome } from '../operation-board/operation-board-live-projection.js';
import { buildImportantAttacks } from '../operation-board/operation-board-live-recommendations.js';
import { escapeHtml, number } from '../operation-board/operation-board-utils.js';
import { normalizeWarState, parseClashTime } from '../cwl/cwl-war-state.js';
import { competeT as t } from '../operation-board/compete-locales.js';
import {
    ASSET_FALLBACKS,
    getTownHallAsset,
    installImageFallback
} from '../assets/entity-assets.js';
import { buildWarContributions } from './war-contribution.js';
import { buildWarMap } from './war-map-model.js';
import { assignmentState } from './war-assignments.js';
import { buildMathematicalWarStatus } from './war-outcome-model.js';
import { renderStats as renderStatsSection } from './war-stats-renderer.js';

const WAR_STATE_CLASSES = new Set(['completed', 'live', 'preparation']);
const BASE_STATE_CLASSES = new Set(['cleared', 'damaged', 'untouched']);
const MATH_STATE_CLASSES = new Set(['lost', 'open', 'won']);
const ASSIGNMENT_STATE_CLASSES = new Set(['changed', 'completed', 'planned']);

export { renderStatsSection as renderStats };

export function renderScoreStrip(element, report) {
    const live = buildLiveView(report);
    const projection = buildProjectedOutcome(report, { simulations: 600 });
    const condition = buildWinCondition(report);
    const mathematical = buildMathematicalWarStatus(report);
    if (!live) {
        element.innerHTML = '';
        return;
    }
    const liveState = classToken(live.state, WAR_STATE_CLASSES, 'unknown');
    const mathStatus = classToken(
        mathematical?.status,
        MATH_STATE_CLASSES,
        'open'
    );
    element.innerHTML = `
        <div class="war-score-side war-score-own">
            ${badge(report.clan)}
            <span><strong>${escapeHtml(live.own.name)}</strong><small>${live.own.attacksUsed}/${live.own.availableAttacks} ${escapeHtml(t('war.attacks'))}</small></span>
        </div>
        <div class="war-score-main">
            <span>${stars(live.own.stars)} <b>—</b> ${stars(live.opponent.stars)}</span>
            <small>${percent(live.own.destruction)} — ${percent(live.opponent.destruction)}</small>
        </div>
        <div class="war-score-side war-score-opponent">
            <span><strong>${escapeHtml(live.opponent.name)}</strong><small>${live.opponent.attacksUsed}/${live.opponent.availableAttacks} ${escapeHtml(t('war.attacks'))}</small></span>
            ${badge(report.opponent)}
        </div>
        <div class="war-score-meta">
            <span class="war-state-pill is-${liveState}">${stateLabel(live.state)}</span>
            <span>${timeLabel(live, report.wars?.[0]?.fixtureReferenceTime)}</span>
            <span>${escapeHtml(t('war.maxStars', {
                stars: number(condition?.maxFinalStars ?? live.own.stars)
            }))}</span>
            <span class="war-math-status is-${mathStatus}">${mathLabel(mathematical?.status)}</span>
            <span>${escapeHtml(projection?.winProbability == null
                ? t('war.projectionBuilding')
                : t('war.projectedWin', { probability: projection.winProbability }))}</span>
        </div>`;
}
export function renderWarMap(element, report, sideName, selectedPosition, assignments) {
    const bases = buildWarMap(report, sideName);
    element.innerHTML = bases.map((base, index) => {
        const assignmentCount = sideName === 'enemy'
            ? assignments.filter(item => Number(item.targetPosition) === base.mapPosition).length
            : 0;
        const baseState = classToken(base.state, BASE_STATE_CLASSES, 'untouched');
        const townHall = townHallLabel(base.townHall);
        return `<button class="war-base is-${baseState} ${base.mapPosition === selectedPosition ? 'is-selected' : ''}"
            type="button" data-base-position="${base.mapPosition}" style="--base-index:${index}">
            <span class="war-base-position">${base.mapPosition}</span>
            <span class="war-base-emblem"><img class="compete-townhall" src="${getTownHallAsset(base.townHall)}" alt="${escapeHtml(t('war.townHall', { level: townHall }))}"><i>${stars(base.stars)}</i></span>
            <span class="war-base-copy"><strong>${escapeHtml(base.name)}</strong><small>${percent(base.destruction)} · ${base.opponentAttacks} ${escapeHtml(t(base.opponentAttacks === 1 ? 'war.hit' : 'war.hits'))}</small></span>
            ${assignmentCount ? `<span class="war-base-assigned">${escapeHtml(t('war.assigned', { count: assignmentCount }))}</span>` : ''}
        </button>`;
    }).join('');
    installAssetFallbacks(element);
}

export function renderBaseDetail(element, report, sideName, position, assignments) {
    const bases = buildWarMap(report, sideName);
    const base = bases.find(item => item.mapPosition === position) || bases[0];
    if (!base) {
        element.innerHTML = `<div class="war-detail-empty">${escapeHtml(t('war.selectBase'))}</div>`;
        return;
    }
    const townHall = townHallLabel(base.townHall);
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
            <div><p>${escapeHtml(t('war.base', { position: base.mapPosition }))}</p><h2>${escapeHtml(base.name)}</h2><span>${escapeHtml(base.tag)}</span></div>
            <span class="war-detail-th"><img class="compete-townhall" src="${getTownHallAsset(base.townHall)}" alt="${escapeHtml(t('war.townHall', { level: townHall }))}"> ${escapeHtml(t('war.townHallShort'))}${escapeHtml(townHall)}</span>
        </header>
        <div class="war-detail-score"><strong>${stars(base.stars)}</strong><span>${percent(base.destruction)} ${escapeHtml(t('war.bestDestruction'))}</span></div>
        <section><h3>${escapeHtml(t('war.attackHistory'))}</h3>${base.attacks.length ? base.attacks.map(attack => `
            <div class="war-detail-row"><span>${escapeHtml(attack.attackerName)} · ${escapeHtml(t('war.townHallShort'))}${attack.attackerTownHall}</span><strong>${stars(attack.stars)} · ${percent(attack.destructionPercentage)}</strong></div>`).join('') : `<p class="war-muted">${escapeHtml(t('war.noAttacks'))}</p>`}</section>
        ${sideName === 'enemy' ? `<section><h3>${escapeHtml(t('war.assignments'))}</h3>
            <div class="war-assignment-list">${assigned.length ? assigned.map(item => `
                <div class="war-assignment-item"><span>${escapeHtml(roster.find(player => player.tag === item.playerTag)?.name || item.playerTag)} · ${escapeHtml(t('war.attackSlot', { slot: item.attackSlot }))} · ${assignmentLabel(item, base.mapPosition)}</span><em class="is-${assignmentClass(item, report)}">${escapeHtml(assignmentStateLabel(item, report))}</em><button type="button" data-remove-assignment="${escapeHtml(item.id)}" aria-label="${escapeHtml(t('war.removeAssignment'))}">×</button></div>`).join('') : `<p class="war-muted">${escapeHtml(t('war.nobodyAssigned'))}</p>`}</div>
            <form class="war-assignment-form" data-assignment-position="${base.mapPosition}">
                <select name="playerTag" required><option value="">${escapeHtml(t('war.assignAttacker'))}</option>${roster.map(player => `<option value="${escapeHtml(player.tag)}">${escapeHtml(player.name)}</option>`).join('')}</select>
                <select name="attackSlot"><option value="1">${escapeHtml(t('war.attackOne'))}</option><option value="2">${escapeHtml(t('war.attackTwo'))}</option></select>
                <select name="type"><option value="base">${escapeHtml(t('war.baseAssignment', { position: base.mapPosition }))}</option><option value="cleanup">${escapeHtml(t('war.cleanupAssignment', { position: base.mapPosition }))}</option><option value="hold">${escapeHtml(t('war.hold'))}</option><option value="free">${escapeHtml(t('war.freeAttack'))}</option></select>
                <button type="submit">${escapeHtml(t('war.assign'))}</button>
            </form></section>` : ''}
        ${recommendations.length ? `<section><h3>${escapeHtml(t('war.recommendedMatchup'))}</h3>${recommendations.slice(0, 2).map(item => `
            <div class="war-recommendation"><strong>${escapeHtml(item.attacker.name)}</strong><span>${escapeHtml(t('war.expectedStarsNet', { stars: item.expectedStars.toFixed(1), net: item.expectedNetStars.toFixed(1) }))}</span><small>${reasonLabel(item.reason)} · ${escapeHtml(t('war.confidence', { confidence: item.confidence }))}</small></div>`).join('')}</section>` : ''}`;
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
            data-player-tag="${escapeHtml(player.tag)}" data-town-hall="${escapeHtml(townHallLabel(player.townHall))}">
            <button class="war-player-main" type="button" data-performance-trigger>
                <span class="war-player-position">${player.mapPosition}</span>
                <span><strong class="cwl-player-name"><img class="compete-townhall" src="${getTownHallAsset(player.townHall)}" alt="${escapeHtml(t('war.townHall', { level: townHallLabel(player.townHall) }))}">${escapeHtml(player.name)}</strong><small>${escapeHtml(t('war.townHallShort'))}${escapeHtml(townHallLabel(player.townHall))} · ${escapeHtml(player.tag)}</small></span>
            </button>
            <div class="war-player-metrics">
                <span><small>${escapeHtml(t('war.attacks'))}</small><strong>${player.attacksUsed}/${limit}</strong></span>
                <span><small>${escapeHtml(t('war.starsLabel'))}</small><strong>${stars(player.stars)}</strong></span>
                <span><small>${escapeHtml(t('war.netStarsLabel'))}</small><strong>+${player.netStars}</strong></span>
                <span><small>${escapeHtml(t('war.avgDestruction'))}</small><strong>${player.avgDestruction == null ? '—' : percent(player.avgDestruction)}</strong></span>
            </div>
            <span class="war-player-status is-${attention(player) ? 'attention' : player.attacksUsed >= limit ? 'done' : player.attacksUsed ? 'active' : 'ready'}">${statusLabel(report, player, limit, attention(player))}</span>
        </article>`).join('') || `<p class="war-muted">${escapeHtml(t('war.noPlayersMatch'))}</p>`;
    installAssetFallbacks(element);
}

function badge(clan) {
    const badgeUrl = safeBadgeUrl(clan?.badgeUrl);
    return badgeUrl
        ? `<img src="${escapeHtml(badgeUrl)}" alt="${escapeHtml(t('war.clanBadge', { clan: clan.name || t('war.clanLabel') }))}" loading="lazy">`
        : `<img src="${ASSET_FALLBACKS.clan}" alt="${escapeHtml(t('war.clanBadgeUnavailable'))}">`;
}

function stars(value) {
    return t('war.stars', { count: number(value) });
}

function percent(value) {
    return `${number(value).toFixed(1)}%`;
}

function stateLabel(state) {
    const key = ({
        live: 'war.stateLive',
        preparation: 'war.statePreparation',
        completed: 'war.stateEnded'
    })[state] || 'war.stateUnavailable';
    return t(key);
}

function timeLabel(live, referenceTime = '') {
    const date = live.state === 'preparation' ? live.startTime : live.endTime;
    if (!date) return t('war.timeUnavailable');
    const fixtureNow = parseClashTime(referenceTime)?.getTime();
    const remaining = (parseClashTime(date)?.getTime() || 0) - (fixtureNow || Date.now());
    if (remaining <= 0) return live.state === 'completed' ? t('war.warEnded') : t('war.updating');
    const hours = Math.floor(remaining / 3_600_000);
    const minutes = Math.floor(remaining % 3_600_000 / 60_000);
    const duration = hours
        ? t('war.durationHoursMinutes', { hours, minutes })
        : t('war.durationMinutes', { minutes });
    return t('war.timeRemaining', { duration });
}

function reasonLabel(reason) {
    return t({
        highImpact: 'war.reasonHighImpact',
        goodMatchup: 'war.reasonGoodMatchup',
        bestAvailable: 'war.reasonBestAvailable'
    }[reason] || 'war.reasonRecommended');
}

function mathLabel(status) {
    return t(status === 'won'
        ? 'war.mathWon'
        : status === 'lost' ? 'war.mathLost' : 'war.mathOpen');
}

function assignmentLabel(assignment, position) {
    if (assignment.type === 'hold') return t('war.hold');
    if (assignment.type === 'free') return t('war.freeAttack');
    return assignment.type === 'cleanup'
        ? t('war.cleanupAssignment', { position: `#${position}` })
        : t('war.baseAssignment', { position: `#${position}` });
}

function assignmentClass(assignment, report) {
    return classToken(
        assignmentState(assignment, report),
        ASSIGNMENT_STATE_CLASSES,
        'planned'
    );
}

function assignmentStateLabel(assignment, report) {
    const state = assignmentState(assignment, report);
    return t({
        planned: 'war.assignmentPlanned',
        changed: 'war.assignmentChanged',
        completed: 'war.assignmentCompleted'
    }[state] || 'war.assignmentPlanned');
}

function classToken(value, allowed, fallback) {
    return allowed.has(String(value)) ? String(value) : fallback;
}

function townHallLabel(value) {
    const parsed = number(value, 0);
    return parsed >= 1 && parsed <= 18 ? String(parsed) : t('war.unknown');
}

function safeBadgeUrl(value) {
    const raw = String(value || '').trim();
    if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
    try {
        const url = new URL(raw);
        return ['http:', 'https:'].includes(url.protocol) ? raw : '';
    } catch {
        return '';
    }
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
    if (ended && player.attacksUsed < limit) return t('war.missedAttacks');
    if (attention) return t('war.statusNeedsAttention');
    if (player.attacksUsed >= limit) return t('war.statusDone');
    return player.attacksUsed ? t('war.statusInProgress') : t('war.statusReady');
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
