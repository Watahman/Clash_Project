import { trackCoreAction } from '../analytics/product-analytics.js?v=20260912-product-analytics-v1';

export function createMinigameLifecycleTracker(mode) {
    let startedRun;
    let completedRun;

    function trackStarted(run) {
        if (!run || run.completed || run === startedRun) return;
        startedRun = run;
        trackCoreAction({
            tool: 'minigames',
            action: 'game_started',
            entity_type: 'minigame',
            mode,
            source: 'frontend'
        });
    }

    function trackCompleted(run, outcome) {
        if (!run?.completed || run === completedRun) return;
        completedRun = run;
        trackCoreAction({
            tool: 'minigames',
            action: 'game_completed',
            entity_type: 'minigame',
            mode,
            outcome,
            result_status: 'complete',
            source: 'frontend'
        });
    }

    return Object.freeze({ trackStarted, trackCompleted });
}
