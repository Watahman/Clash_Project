import {
    applySuggestionActions,
    buildPlanState,
    normalizeOptimizationInput,
    toApplicablePlan
} from './cwl-optimize-plan-model.js';
import { generateOptimizationSuggestions } from './cwl-optimize-plan-objective.js';

export function buildOptimizePlan(input) {
    const normalized = normalizeOptimizationInput(input);
    const current = buildPlanState(normalized);
    const suggestions = generateOptimizationSuggestions(normalized);
    const allIds = suggestions.map(suggestion => suggestion.id);
    const optimized = applySuggestionActions(normalized, suggestions, allIds);
    return {
        input: normalized,
        current,
        optimized,
        suggestions,
        comparison: compareStates(current, optimized, suggestions),
        clanAdvice: buildClanAdvice(current, suggestions)
    };
}

export function buildAcceptedOptimization(result, selectedIds) {
    const state = applySuggestionActions(
        result.input,
        result.suggestions,
        selectedIds
    );
    return {
        state,
        plan: toApplicablePlan(state),
        comparison: compareStates(
            result.current,
            state,
            result.suggestions.filter(suggestion => selectedIds.includes(suggestion.id))
        )
    };
}

function compareStates(current, optimized, suggestions) {
    return {
        current: current.metrics,
        optimized: optimized.metrics,
        playerChanges: new Set(suggestions.flatMap(suggestion =>
            suggestion.actions.map(action => action.playerTag)
        )).size,
        improvementCount: suggestions.length
    };
}

function buildClanAdvice(current, suggestions) {
    return Object.fromEntries(current.clans.map(clan => {
        const clanSuggestions = suggestions.filter(suggestion =>
            suggestion.clanIds.includes(clan.id)
        );
        let status = 'changes';
        if (!clanSuggestions.length) {
            status = clan.readiness.status === 'risk'
                ? 'no-safe-optimization'
                : 'no-changes';
        } else if (clanSuggestions.some(suggestion =>
            suggestion.type === 'cross-clan-swap'
        )) {
            status = 'cross-clan';
        }
        return [clan.id, { status, suggestionIds: clanSuggestions.map(item => item.id) }];
    }));
}
