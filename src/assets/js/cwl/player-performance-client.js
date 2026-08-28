import { requestJson } from '../utils/request-json.js';
import * as config from '../Data/config.js';
import { isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';

const performanceByTag = new Map();
const pendingTags = new Set();
const inFlightByTag = new Map();
const REQUEST_BATCH_SIZE = 20;
let batchTimer;

function normalizeTag(tag = '') {
    const clean = String(tag).trim().toUpperCase();
    if (!clean) return '';
    return clean.startsWith('#') ? clean : `#${clean}`;
}

export function getPlayerPerformance(tag) {
    return performanceByTag.get(normalizeTag(tag)) || null;
}

export function collectPlannerPlayerTags(root = document) {
    return Array.from(
        root.querySelectorAll('.cwl-player-article[data-planner-card="true"][data-player-tag]')
    ).map(card => normalizeTag(card.dataset.playerTag)).filter(Boolean);
}

export function schedulePlayerPerformanceBatch(tags = collectPlannerPlayerTags()) {
    tags.map(normalizeTag).filter(Boolean).forEach(tag => {
        if (!performanceByTag.has(tag) && !pendingTags.has(tag) && !inFlightByTag.has(tag)) {
            pendingTags.add(tag);
        }
    });
    if (!pendingTags.size) return;
    window.clearTimeout(batchTimer);
    batchTimer = window.setTimeout(flushPlayerPerformanceBatch, 60);
}

export async function flushPlayerPerformanceBatch() {
    window.clearTimeout(batchTimer);
    const tags = Array.from(pendingTags);
    if (!tags.length) return {};
    tags.forEach(tag => pendingTags.delete(tag));

    let requestPromise;
    requestPromise = (async () => {
        const results = {};
        const errorsByTag = new Map();
        try {
            for (const playerTags of chunkTags(tags, REQUEST_BATCH_SIZE)) {
                try {
                    const response = await requestJson(
                        config._BASE_URL + config._EXT_PLAYER_PERFORMANCE,
                        {
                            body: { playerTags },
                            loading: 'background',
                            timeoutMs: 30_000
                        }
                    );
                    Object.assign(results, response?.results || {});
                } catch (error) {
                    playerTags.forEach(tag => errorsByTag.set(tag, error));
                }
            }
            tags.forEach(tag => {
                performanceByTag.set(
                    tag,
                    normalizePerformanceResult(results[tag], tag, errorsByTag.get(tag))
                );
            });
        } finally {
            tags.forEach(tag => {
                if (inFlightByTag.get(tag) === requestPromise) inFlightByTag.delete(tag);
            });
        }

        window.dispatchEvent(new CustomEvent(
            'clashtools:player-performance-updated',
            { detail: { tags } }
        ));
        return Object.fromEntries(tags.map(tag => [tag, performanceByTag.get(tag)]));
    })();
    tags.forEach(tag => inFlightByTag.set(tag, requestPromise));
    return requestPromise;
}

export async function loadPlayerPerformanceBatch(tags = []) {
    const normalized = Array.from(new Set(tags.map(normalizeTag).filter(Boolean)));
    if (isRedesignFixtureRequested()) return Object.fromEntries(normalized.map(tag => [tag, null]));
    schedulePlayerPerformanceBatch(normalized);
    const queuedRequest = flushPlayerPerformanceBatch();
    const activeRequests = normalized
        .map(tag => inFlightByTag.get(tag))
        .filter(Boolean);
    await Promise.all([queuedRequest, ...new Set(activeRequests)]);
    return Object.fromEntries(
        normalized.map(tag => [tag, performanceByTag.get(tag) || unavailableResult(tag)])
    );
}

export function primePlannerPlayerPerformance(root = document) {
    const tags = collectPlannerPlayerTags(root);
    if (!tags.length) return Promise.resolve({});
    schedulePlayerPerformanceBatch(tags);
    return flushPlayerPerformanceBatch();
}

export function initPlayerPerformanceClient(root = document) {
    if (isRedesignFixtureRequested()) return;
    // Performance is requested by the Auto Plan action or the player popover.
    // Avoid a full-roster request while the planner is still being assembled.
}

export function clearPlayerPerformanceCache() {
    window.clearTimeout(batchTimer);
    performanceByTag.clear();
    pendingTags.clear();
    inFlightByTag.clear();
}

function normalizePerformanceResult(result, tag, error = null) {
    if (!result || typeof result !== 'object') return unavailableResult(tag, error);
    const value = Number(result.performance);
    return {
        ...result,
        playerTag: result.playerTag || tag,
        performance: Number.isFinite(value)
            ? Math.min(100, Math.max(0, value))
            : result.performance
    };
}

function chunkTags(tags, size) {
    const chunks = [];
    for (let index = 0; index < tags.length; index += size) {
        chunks.push(tags.slice(index, index + size));
    }
    return chunks;
}

function unavailableResult(tag, error = null) {
    return {
        playerTag: tag,
        status: 'unavailable',
        scope: 'All wars',
        confidence: 'Low',
        attackCount: 0,
        reliabilityMessage: 'insufficient_tracked_participation',
        coverage: { attacks: 0, days: 0 },
        clientError: error?.code || error?.message || ''
    };
}
