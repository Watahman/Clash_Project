import { t } from '../../i18n/i18n.js';

export function renderOptimizePlanPreview({
    container,
    result,
    acceptedIds = new Set(),
    ignoredIds = new Set()
}) {
    container.replaceChildren();
    const fragment = document.createDocumentFragment();
    fragment.append(
        node('p', 'cwl-optimize-summary', t(
            result.suggestions.length === 1
                ? 'optimizePlan.foundOne'
                : 'optimizePlan.found',
            { count: result.suggestions.length }
        )),
        renderComparison(result.comparison)
    );
    result.current.clans.forEach(clan => {
        fragment.appendChild(renderClanSuggestions({
            clan,
            result,
            acceptedIds,
            ignoredIds
        }));
    });
    container.appendChild(fragment);
}

function renderComparison(comparison) {
    const section = node('section', 'cwl-optimize-comparison');
    section.append(
        renderMetrics('optimizePlan.currentPlan', comparison.current),
        node('span', 'cwl-optimize-comparison-arrow', '→'),
        renderMetrics('optimizePlan.optimized', comparison.optimized)
    );
    const footer = node('p', 'cwl-optimize-change-count', t('optimizePlan.playerChanges', {
        count: comparison.playerChanges
    }));
    section.appendChild(footer);
    return section;
}

function renderMetrics(titleKey, metrics) {
    const section = node('section', 'cwl-optimize-metric-set');
    section.appendChild(node('h3', '', t(titleKey)));
    const list = node('dl');
    metric(list, t('autoPlan.expectedPerformance'), starValue(metrics.expectedPerformance));
    metric(list, t('autoPlan.reliability'), percentValue(metrics.reliability));
    metric(list, t('autoPlan.lineupChanges'), metrics.lineupChanges);
    metric(list, t('optimizePlan.readiness'), readinessLabel(metrics.readiness));
    section.appendChild(list);
    return section;
}

function renderClanSuggestions({
    clan, result, acceptedIds, ignoredIds
}) {
    const section = node('section', 'cwl-optimize-clan');
    section.dataset.clanId = clan.id;
    const heading = node('header', 'cwl-optimize-clan-heading');
    const title = node('div');
    title.append(
        node('h3', '', `${clan.name} · ${clan.league || t('autoPlan.unknownLeague')}`),
        node('p', '', `${clan.capacity}v${clan.capacity}`)
    );
    heading.append(
        title,
        node(
            'span',
            `cwl-auto-plan-readiness is-${clan.readiness.status}`,
            readinessLabel(clan.readiness.status)
        )
    );
    section.appendChild(heading);
    const suggestions = result.suggestions.filter(suggestion =>
        suggestion.clanIds.includes(clan.id)
    );
    if (!suggestions.length) {
        section.appendChild(renderNoChanges(result.clanAdvice[clan.id]));
        return section;
    }
    const list = node('div', 'cwl-optimize-suggestion-list');
    suggestions.forEach(suggestion => list.appendChild(renderSuggestion({
        suggestion,
        accepted: acceptedIds.has(suggestion.id),
        ignored: ignoredIds.has(suggestion.id)
    })));
    section.appendChild(list);
    return section;
}

function renderSuggestion({ suggestion, accepted, ignored }) {
    const article = node('article', 'cwl-optimize-suggestion');
    article.dataset.suggestionId = suggestion.id;
    article.dataset.state = ignored ? 'ignored' : accepted ? 'accepted' : 'pending';
    const content = node('div', 'cwl-optimize-suggestion-content');
    content.appendChild(node('h4', '', suggestionTitle(suggestion.title)));
    const reasons = node('ul', 'cwl-optimize-reasons');
    suggestion.reasons.forEach(reason =>
        reasons.appendChild(node('li', '', reasonText(reason)))
    );
    content.appendChild(reasons);
    const actions = node('div', 'cwl-optimize-suggestion-actions');
    actions.append(
        suggestionButton('accept', t('optimizePlan.accept'), suggestion.id, accepted),
        suggestionButton('ignore', t('optimizePlan.ignore'), suggestion.id, ignored)
    );
    article.append(content, actions);
    return article;
}

function renderNoChanges(advice) {
    const className = advice.status === 'no-safe-optimization'
        ? 'cwl-optimize-empty is-risk'
        : 'cwl-optimize-empty';
    const key = advice.status === 'no-safe-optimization'
        ? 'optimizePlan.noSafeOptimization'
        : 'optimizePlan.noChanges';
    return node('p', className, t(key));
}

function suggestionTitle(title) {
    if (title.code === 'role') {
        return t('optimizePlan.suggestionRole', {
            player: title.playerName,
            role: t(`autoPlan.role${capitalize(title.role)}`)
        });
    }
    if (title.code === 'move') {
        return t('optimizePlan.suggestionMove', {
            player: title.playerName,
            from: title.fromClanName,
            to: title.toClanName
        });
    }
    if (title.code === 'swap') {
        return t('optimizePlan.suggestionSwap', {
            first: title.incomingName,
            second: title.outgoingName
        });
    }
    if (title.code === 'free') {
        return t('optimizePlan.suggestionFree', { player: title.playerName });
    }
    return t('optimizePlan.suggestionSchedule');
}

function reasonText(reason) {
    if (reason.code === 'fills-roster') {
        return t('optimizePlan.reasonFillsRoster', { clan: reason.clanName });
    }
    if (reason.code === 'reserve-cap') {
        return t('optimizePlan.reasonReserveCap', reason);
    }
    if (reason.code === 'performance') {
        return t('optimizePlan.reasonPerformance', { value: reason.value });
    }
    if (reason.code === 'reliability') {
        return t('optimizePlan.reasonReliability', reason);
    }
    if (reason.code === 'lineup-changes') {
        return t('optimizePlan.reasonLineupChanges', reason);
    }
    if (reason.code === 'risky-rounds') {
        return t('optimizePlan.reasonRiskyRounds', { count: reason.count });
    }
    if (reason.code === 'stability-loss') {
        return t('optimizePlan.reasonStabilityLoss', { value: reason.value });
    }
    return t('optimizePlan.reasonCrossClanSafe');
}

function suggestionButton(action, label, suggestionId, selected) {
    const button = node(
        'button',
        `button button-secondary${selected ? ' is-selected' : ''}`,
        label
    );
    button.type = 'button';
    button.dataset.optimizeAction = action;
    button.dataset.suggestionId = suggestionId;
    button.setAttribute('aria-pressed', String(selected));
    return button;
}

function metric(list, label, value) {
    list.append(node('dt', '', label), node('dd', '', String(value)));
}

function starValue(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)}★` : '—';
}

function percentValue(value) {
    return Number.isFinite(value) ? `${Math.round(value)}%` : '—';
}

function readinessLabel(status) {
    const key = status === 'low-confidence'
        ? 'LowConfidence'
        : capitalize(status);
    return t(`optimizePlan.status${key}`);
}

function node(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== '') element.textContent = text;
    return element;
}

function capitalize(value) {
    return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}
