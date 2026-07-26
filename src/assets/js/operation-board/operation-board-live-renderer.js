import { t } from '../i18n/i18n.js';
import { parseClashTime } from '../cwl/cwl-war-state.js';
import { buildLiveView } from './operation-board-live-model.js';
import {
    escapeHtml,
    number
} from './operation-board-utils.js';
import {
    resultText,
    stateText
} from './operation-board-render-utils.js';

export function renderLiveTab(refs, report) {
    refs.liveContent.replaceChildren();
    const live = buildLiveView(report);
    if (!live) {
        refs.liveContent.appendChild(emptyLiveState());
        return;
    }
    const completed = live.state === 'completed';
    refs.liveContent.innerHTML = `
        <section class="op-live-command">
            <header class="op-live-heading">
                <div>
                    <span>${escapeHtml(t('op.day'))} ${live.day || '—'}</span>
                    <strong>${escapeHtml(stateText(live.state))}</strong>
                </div>
                <p>${escapeHtml(timeLabel(live))}</p>
            </header>
            <div class="op-live-versus">
                ${sideMarkup(live.own)}
                <span class="op-live-versus-mark">${escapeHtml(t('op.versus'))}</span>
                ${sideMarkup(live.opponent)}
            </div>
        </section>
        <div class="op-live-followup">
            <section class="op-flat-section">
                <div class="op-section-heading"><div><h2>${escapeHtml(t('op.winCondition'))}</h2></div></div>
                <div class="op-live-message">
                    <strong>${escapeHtml(completed ? resultText(live.result) : t('op.liveAnalysisPending'))}</strong>
                    <p>${escapeHtml(completed ? t('op.finalWarResult') : t('op.winConditionHelp'))}</p>
                </div>
            </section>
            <section class="op-flat-section">
                <div class="op-section-heading"><div><h2>${escapeHtml(t('op.attackPriorities'))}</h2></div></div>
                <div class="op-live-message">
                    <strong>${escapeHtml(completed ? t('op.warCompleted') : t('op.prioritiesPending'))}</strong>
                    <p>${escapeHtml(completed ? t('op.noMoreRecommendations') : t('op.prioritiesHelp'))}</p>
                </div>
            </section>
        </div>`;
}

export function clearLiveTab(refs) {
    refs.liveContent.replaceChildren();
}

function sideMarkup(side) {
    const hasOpponentData = side.stars != null;
    return `
        <article class="op-live-side">
            <h2>${escapeHtml(side.name || '—')}</h2>
            <strong>${hasOpponentData ? number(side.stars, 0) : '—'}<small>★</small></strong>
            <dl>
                <div><dt>${escapeHtml(t('op.destruction'))}</dt><dd>${hasOpponentData ? `${number(side.destruction, 0).toFixed(1)}%` : '—'}</dd></div>
                <div><dt>${escapeHtml(t('op.attacks'))}</dt><dd>${number(side.attacksUsed, 0)}/${number(side.availableAttacks, 0)}</dd></div>
                <div><dt>${escapeHtml(t('op.remainingAttacks'))}</dt><dd>${number(side.remainingAttacks, 0)}</dd></div>
            </dl>
        </article>`;
}

function timeLabel(live) {
    const value = live.state === 'preparation' ? live.startTime : live.endTime;
    if (!value) return stateText(live.state);
    const parsed = parseClashTime(value);
    if (!parsed) return stateText(live.state);
    return new Intl.DateTimeFormat(
        document.documentElement.lang || undefined,
        { dateStyle: 'medium', timeStyle: 'short' }
    ).format(parsed);
}

function emptyLiveState() {
    const empty = document.createElement('section');
    empty.className = 'op-tab-empty-state';
    empty.innerHTML = `
        <h2>${escapeHtml(t('op.noCurrentMatchup'))}</h2>
        <p>${escapeHtml(t('op.noCurrentMatchupHelp'))}</p>`;
    return empty;
}
