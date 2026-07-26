import { requestJson } from '../utils/request-json.js';
import * as config from '../Data/config.js';

const performanceByTag = new Map();
const pendingTags = new Set();
const inFlightTags = new Set();
const MAX_BATCH_SIZE = 100;
let batchTimer;
let observer;

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
        if (!performanceByTag.has(tag) && !pendingTags.has(tag) && !inFlightTags.has(tag)) {
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
    tags.forEach(tag => inFlightTags.add(tag));

    try {
        const batches = [];
        for (let index = 0; index < tags.length; index += MAX_BATCH_SIZE) {
            batches.push(tags.slice(index, index + MAX_BATCH_SIZE));
        }
        const responses = await Promise.all(batches.map(playerTags => requestJson(
            config._BASE_URL + config._EXT_PLAYER_PERFORMANCE,
            {
                body: { playerTags },
                loading: 'background',
                timeoutMs: 30_000
            }
        )));
        const results = Object.assign({}, ...responses.map(response => response?.results || {}));
        tags.forEach(tag => {
            performanceByTag.set(tag, results[tag] || unavailableResult(tag));
        });
    } catch (error) {
        tags.forEach(tag => performanceByTag.set(tag, unavailableResult(tag, error)));
    } finally {
        tags.forEach(tag => inFlightTags.delete(tag));
    }

    window.dispatchEvent(new CustomEvent(
        'clashtools:player-performance-updated',
        { detail: { tags } }
    ));
    return Object.fromEntries(tags.map(tag => [tag, performanceByTag.get(tag)]));
}

export function initPlayerPerformanceClient(root = document) {
    schedulePlayerPerformanceBatch(collectPlannerPlayerTags(root));
    const refresh = () => schedulePlayerPerformanceBatch(collectPlannerPlayerTags(root));
    for (const eventName of [
        'clashtools:cwl-player-added',
        'clashtools:cwl-player-removed',
        'clashtools:cwl-plan-loaded'
    ]) {
        window.addEventListener(eventName, refresh);
    }
    observer?.disconnect();
    observer = new MutationObserver(refresh);
    const planner = root.querySelector('.workspace-planner') || root.body;
    if (planner) observer.observe(planner, { childList: true, subtree: true });
}

export function clearPlayerPerformanceCache() {
    performanceByTag.clear();
    pendingTags.clear();
    inFlightTags.clear();
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
