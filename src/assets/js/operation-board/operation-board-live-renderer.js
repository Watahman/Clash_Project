import { parseClashTime } from '../cwl/cwl-war-state.js';
import { competeT as t } from './compete-locales.js?v=20260829-public-auth-v1';
import { buildLiveView } from './operation-board-live-model.js';
import {
    buildProjectedOutcome
} from './operation-board-live-projection.js';
import {
    buildImportantAttacks
} from './operation-board-live-recommendations.js';
import {
    resultText,
    stateText
} from './operation-board-render-utils.js?v=20260829-public-auth-v1';
import {
    installLiveBadgeFallbacks,
    liveSideMarkup
} from './operation-board-live-side-renderer.js?v=20260829-public-auth-v1';
import { buildWinCondition } from './operation-board-win-condition.js';
import {
    escapeHtml,
    number
} from './operation-board-utils.js';

export function renderLiveTab(refs, report) {
    refs.liveContent.replaceChildren();
    const live = buildLiveView(report);
    if (!live) {
        refs.liveContent.appendChild(emptyLiveState());
        return;
    }
    const winCondition = buildWinCondition(report);
    const projection = buildProjectedOutcome(report);
    const recommendations = buildImportantAttacks(report);
    refs.liveContent.innerHTML = `
        <section class="op-live-command">
            <header class="op-live-heading">
                <span>${escapeHtml(t('op.day'))} ${live.day || '—'}</span>
                <span aria-hidden="true">·</span>
                <strong>${escapeHtml(stateText(live.state))}</strong>
                <span aria-hidden="true">·</span>
                <span>${escapeHtml(timeLabel(live))}</span>
            </header>
            <div class="op-live-versus">
                ${liveSideMarkup(live.own)}
                <span class="op-live-versus-mark">${escapeHtml(t('op.versus'))}</span>
                ${liveSideMarkup(live.opponent)}
            </div>
            ${live.state === 'completed' ? finalResultMarkup(live) : ''}
        </section>
        <div class="op-live-analysis">
            ${winConditionMarkup(winCondition, live)}
            ${projectionMarkup(projection)}
        </div>
        ${recommendationsMarkup(recommendations, live.state)}`;
    installLiveBadgeFallbacks(refs.liveContent);
}

export function clearLiveTab(refs) {
    refs.liveContent.replaceChildren();
}

function finalResultMarkup(live) {
    return `
        <footer class="op-live-final" data-result="${escapeHtml(live.result)}">
            <span>${escapeHtml(t('op.finalResult'))}</span>
            <strong>${escapeHtml(resultText(live.result))}</strong>
        </footer>`;
}

function winConditionMarkup(condition, live) {
    if (!condition) return '';
    const completed = live.state === 'completed';
    const impossible = !condition.mathematicallyPossible
        && !completed;
    return `
        <section class="op-flat-section op-win-condition">
            <div class="op-section-heading">
                <div><h2>${escapeHtml(t('op.winCondition'))}</h2></div>
                <span class="op-analysis-status" data-state="${escapeHtml(condition.state)}">
                    ${escapeHtml(currentStateText(condition.state))}
                </span>
            </div>
            <div class="op-win-body">
                <strong>${escapeHtml(
                    completed
                        ? resultText(live.result)
                        : impossible
                        ? t('op.cannotPassCurrentScore')
                        : requirementText(condition.requirement)
                )}</strong>
                <p>${escapeHtml(
                    completed
                        ? t('op.finalWarResult')
                        : condition.opponentCanRespond
                        ? t('op.currentScoreDisclaimer', {
                            count: condition.opponentRemaining
                        })
                        : t('op.currentScoreSnapshot')
                )}</p>
                <dl class="op-live-facts">
                    <div><dt>${escapeHtml(t('op.ownAttacksLeft'))}</dt><dd>${condition.ownRemaining}</dd></div>
                    <div><dt>${escapeHtml(t('op.enemyAttacksLeft'))}</dt><dd>${condition.opponentRemaining}</dd></div>
                    <div><dt>${escapeHtml(t('op.maxStarImprovement'))}</dt><dd>+${number(condition.maxStarImprovement, 0)} ${escapeHtml(t('cwl.starsUnit'))}</dd></div>
                </dl>
            </div>
        </section>`;
}

function projectionMarkup(projection) {
    if (!projection) return '';
    return `
        <section class="op-flat-section op-live-projection">
            <div class="op-section-heading">
                <div><h2>${escapeHtml(t('op.projectedFinal'))}</h2></div>
                <span class="op-analysis-status" data-state="${escapeHtml(projection.status)}">
                    ${escapeHtml(t(`op.outcome${capitalize(projection.status)}`))}
                </span>
            </div>
            <div class="op-projection-score">
                <strong>${number(projection.own.stars, 0).toFixed(1)}<small> ${escapeHtml(t('cwl.starsUnit'))}</small></strong>
                <span>${number(projection.own.destruction, 0).toFixed(1)}%</span>
                <small>${escapeHtml(t('op.projectedOpponent', {
                    stars: number(projection.opponent.stars, 0).toFixed(1),
                    destruction: number(projection.opponent.destruction, 0).toFixed(1)
                }))}</small>
            </div>
            <p class="op-probability" data-state="${escapeHtml(projection.probabilityState)}">
                ${escapeHtml(projection.winProbability == null
                    ? t('op.winProbabilityInsufficient')
                    : t('op.winProbabilityValue', {
                        probability: probabilityText(
                            projection.winProbability
                        )
                    }))}
            </p>
        </section>`;
}

function recommendationsMarkup(recommendations, state) {
    const completed = state === 'completed';
    const body = completed
        ? `<div class="op-live-message"><strong>${escapeHtml(t('op.warCompleted'))}</strong><p>${escapeHtml(t('op.noMoreRecommendations'))}</p></div>`
        : recommendations.length
            ? `<ol class="op-priority-list">${recommendations.map(
                recommendationMarkup
            ).join('')}</ol>
               <p class="op-advice-note">${escapeHtml(t('op.advisoryOnly'))}</p>`
            : `<div class="op-live-message"><strong>${escapeHtml(t('op.noUsefulTargets'))}</strong><p>${escapeHtml(t('op.noUsefulTargetsHelp'))}</p></div>`;
    return `
        <section class="op-flat-section op-important-attacks">
            <div class="op-section-heading">
                <div>
                    <h2>${escapeHtml(t('op.importantAttacks'))}</h2>
                    <p class="op-section-description">${escapeHtml(t('op.importantAttacksHelp'))}</p>
                </div>
            </div>
            ${body}
        </section>`;
}

function recommendationMarkup(item) {
    const impact = item.expectedNetStars >= 0.05
        ? t('op.expectedNetStars', {
            stars: item.expectedNetStars.toFixed(1)
        })
        : t('op.destructionOpportunity', {
            destruction: item.expectedDestructionImprovement.toFixed(1)
        });
    return `
        <li>
            <div class="op-priority-route">
                <strong>${escapeHtml(item.attacker.name)}</strong>
                <span aria-hidden="true">→</span>
                <strong>#${number(item.target.mapPosition, 0)}</strong>
            </div>
            <div class="op-priority-expectation">
                <span>${escapeHtml(t('op.expectedStars', {
                    stars: item.expectedStars.toFixed(1)
                }))}</span>
                <strong>${escapeHtml(impact)}</strong>
            </div>
            <div class="op-priority-signals">
                <span>${escapeHtml(t(`op.reason${capitalize(item.reason)}`))}</span>
                <span>${escapeHtml(t(`op.matchup${item.difficulty}`))}</span>
                <span data-confidence="${escapeHtml(item.confidence.toLowerCase())}">
                    ${escapeHtml(t('op.confidenceValue', {
                        confidence: t(`performance.confidence${item.confidence}`)
                    }))}
                </span>
            </div>
        </li>`;
}

function requirementText(requirement = {}) {
    if (requirement.type === 'alreadyLeading') return t('op.holdCurrentLead');
    if (requirement.type === 'matchAndDestruction') {
        return t('op.matchAndImprove', {
            stars: requirement.matchStars,
            destruction: requirement.destruction.toFixed(1)
        });
    }
    return t('op.addStarsToLead', { stars: requirement.stars || 1 });
}

function probabilityText(value) {
    if (value <= 0) return '<1';
    if (value >= 100) return '>99';
    return String(value);
}

function currentStateText(state) {
    return t(`op.currently${capitalize(state)}`);
}

function timeLabel(live, currentTime = Date.now()) {
    if (live.state === 'completed') return t('op.final');
    const value = live.state === 'preparation' ? live.startTime : live.endTime;
    const parsed = parseClashTime(value);
    if (!parsed) return stateText(live.state);
    const milliseconds = Math.max(0, parsed.getTime() - currentTime);
    const totalMinutes = Math.ceil(milliseconds / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const duration = hours
        ? t('op.durationHoursMinutes', { hours, minutes })
        : t('op.durationMinutes', { minutes });
    return live.state === 'preparation'
        ? t('op.startsIn', { duration })
        : t('op.timeRemaining', { duration });
}

function emptyLiveState() {
    const empty = document.createElement('section');
    empty.className = 'op-tab-empty-state';
    empty.innerHTML = `
        <h2>${escapeHtml(t('op.noCurrentMatchup'))}</h2>
        <p>${escapeHtml(t('op.noCurrentMatchupHelp'))}</p>`;
    return empty;
}

function capitalize(value = '') {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
