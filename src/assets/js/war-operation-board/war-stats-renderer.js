import { buildImportantAttacks } from '../operation-board/operation-board-live-recommendations.js';
import { buildLiveView } from '../operation-board/operation-board-live-model.js';
import { escapeHtml, number } from '../operation-board/operation-board-utils.js';
import { competeT as t } from '../operation-board/compete-locales.js?v=20260829-public-auth-v1';
import { attacksByOrder } from './war-contribution.js';

export function renderStats(element, report) {
    const live = buildLiveView(report);
    const attacks = attacksByOrder(report);
    const recommendations = buildImportantAttacks(report, 3);
    const use = live?.own.availableAttacks
        ? live.own.attacksUsed / live.own.availableAttacks * 100
        : 0;
    const points = cumulativePoints(attacks);
    element.innerHTML = `
        <article class="war-stat-card"><p>${escapeHtml(t('war.attackUsage'))}</p><strong>${Math.round(use)}%</strong><div class="war-progress"><i style="width:${use}%"></i></div><small>${escapeHtml(t('war.attacksUsed', { used: live?.own.attacksUsed || 0, available: live?.own.availableAttacks || 0 }))}</small></article>
        <article class="war-stat-card war-chart-card"><p>${escapeHtml(t('war.starsByAttack'))}</p>${sparkline(points)}<small>${attacks.length ? escapeHtml(t('war.recordedAttacks', { count: attacks.length })) : escapeHtml(t('war.waitingFirstAttack'))}</small></article>
        <article class="war-stat-card"><p>${escapeHtml(t('war.importantNextAttacks'))}</p>${recommendations.length ? recommendations.map(item => `<div class="war-mini-row"><span>${escapeHtml(item.attacker.name)} → #${item.target.mapPosition}</span><strong>${escapeHtml(t('war.netStars', { count: item.expectedNetStars.toFixed(1) }))}</strong></div>`).join('') : `<small>${escapeHtml(t('war.noRecommendation'))}</small>`}</article>`;
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
    return `<svg class="war-sparkline" viewBox="0 0 240 72" role="img" aria-label="${escapeHtml(t('war.cumulativeNetStars'))}"><path d="${path}"/></svg>`;
}
