import { describe, expect, it } from 'vitest';
import {
    normalizeAnalysis,
    normalizeCoverage,
    normalizeCoverageDetails,
    pollHistoryAnalysis
} from '../../src/assets/js/pages/advanced-stats-analysis.js';

describe('Advanced Stats historical analysis state', () => {
    it('normalizes explicit backend phases and progress without inventing coverage', () => {
        const analysis = normalizeAnalysis({
            trackingExists: true,
            status: 'ACTIVE',
            analysisPhase: 'FETCHING',
            phaseProgress: 42,
            coverage: { normal: true, war: 'partial', ranked: null },
            battlesAvailable: 80,
            battlesProcessed: 34
        });

        expect(analysis).toMatchObject({
            phase: 'FETCHING',
            progress: 42,
            active: true,
            battlesAvailable: 80,
            battlesProcessed: 34,
            coverage: { normal: 'available', war: 'partial', ranked: 'unknown' }
        });
    });

    it('keeps legacy initializing responses honest and marks completed trackers ready', () => {
        expect(normalizeAnalysis({ trackingExists: true, status: 'INITIALIZING' })).toMatchObject({
            phase: 'PROCESSING',
            active: true,
            progress: null
        });
        expect(normalizeAnalysis({
            trackingExists: true,
            status: 'ACTIVE',
            bootstrapCompletedAt: '2026-08-14T10:00:00Z'
        })).toMatchObject({ phase: 'READY', ready: true, progress: 100 });
    });

    it('returns unknown coverage for missing or unsupported backend fields', () => {
        expect(normalizeCoverage()).toEqual({ normal: 'unknown', war: 'unknown', ranked: 'unknown' });
        expect(normalizeCoverage({ normal: { count: 10 }, war: 'mystery', ranked: false })).toEqual({
            normal: 'unknown',
            war: 'unknown',
            ranked: 'unavailable'
        });
    });

    it('keeps source labels while excluding internal source identifiers', () => {
        const details = normalizeCoverageDetails({
            normal: { status: 'PARTIAL', sourceLabel: 'ClashKing', sourceId: 'internal-42', reasonLabel: 'Legacy limit' },
            war: { status: 'unavailable', provider: 'Clash of Clans' }
        });

        expect(details).toMatchObject({
            normal: { state: 'partial', source: 'ClashKing', reason: 'Legacy limit' },
            war: { state: 'unavailable', source: 'Clash of Clans' }
        });
        expect(JSON.stringify(details)).not.toContain('internal-42');
    });

    it('translates provider IDs and hides unknown internal source values', () => {
        const details = normalizeCoverageDetails({
            normal: { provider: 'clashking-v2' },
            war: { provider: 'coc-battlelog' },
            ranked: { provider: 'ranked-battlelog' }
        });
        const unknown = normalizeCoverageDetails({ normal: { provider: 'internal-source-42' } });

        expect(details).toMatchObject({
            normal: { source: 'ClashKing' },
            war: { source: 'Official battle log' },
            ranked: { source: 'Ranked battle log' }
        });
        expect(JSON.stringify(details)).not.toMatch(/clashking-v2|coc-battlelog|ranked-battlelog/i);
        expect(unknown.normal.source).toBe('');
    });

    it('treats partial and unsupported terminal statuses as non-polling outcomes', () => {
        expect(normalizeAnalysis({ trackingExists: true, bootstrapStatus: 'PARTIAL', bootstrapProgress: 100 })).toMatchObject({
            phase: 'PARTIAL', active: false, ready: true, progress: null
        });
        expect(normalizeAnalysis({ trackingExists: true, analysisPhase: 'UNSUPPORTED' })).toMatchObject({
            phase: 'UNSUPPORTED', active: false, ready: true
        });
    });

    it('normalizes V2 scope progress and keeps a separate aggregation phase', () => {
        const analysis = normalizeAnalysis({
            trackingExists: true,
            analysisPhase: 'FETCHING',
            analysisScopes: {
                normal: { status: 'READY', progress: 100, processed: 42, available: 42 },
                war: { status: 'PARTIAL', progress: 100, processed: 12, available: 12 },
                ranked: { status: 'UNSUPPORTED', sourceLabel: 'Ranked battlelog' }
            },
            analysisAggregation: { status: 'PROCESSING', progress: 61 }
        });

        expect(analysis.scopes).toMatchObject({
            available: true,
            normal: { phase: 'READY', ready: true, progress: 100, processed: 42 },
            war: { phase: 'PARTIAL', ready: true, progress: null },
            ranked: { phase: 'UNSUPPORTED', ready: true, active: false },
            aggregate: { phase: 'PROCESSING', progress: 61, active: true }
        });
    });

    it('reads the compact status response shape used by the backend', () => {
        const analysis = normalizeAnalysis({
            trackingExists: true,
            analysisPhase: 'BOOTSTRAPPING',
            analysisProgress: 36,
            analysisProcessed: 18,
            analysisTotal: 50,
            analysisScopes: [
                { scope: 'normal', bootstrapStatus: 'RUNNING', coverage: 'PENDING', progress: 36, processed: 18, total: 50, source: { provider: 'ClashKing' } },
                { scope: 'war', bootstrapStatus: 'PARTIAL', capabilityStatus: 'PARTIAL', coverage: 'PARTIAL', progress: 100, processed: 12, total: 12 },
                { scope: 'ranked', bootstrapStatus: 'PENDING', capabilityStatus: 'UNSUPPORTED', coverage: 'UNSUPPORTED', progress: 0 }
            ]
        });

        expect(analysis).toMatchObject({ phase: 'FETCHING', active: true, progress: 36, battlesProcessed: 18, battlesAvailable: 50 });
        expect(analysis.scopes).toMatchObject({
            available: true,
            normal: { phase: 'PROCESSING', progress: 36, source: { provider: 'ClashKing' } },
            war: { phase: 'PARTIAL', ready: true, progress: null },
            ranked: { phase: 'UNSUPPORTED', ready: true, active: false, progress: null },
            aggregate: { phase: 'QUEUED', active: true }
        });
        expect(analysis.coverage).toEqual({ normal: 'unknown', war: 'partial', ranked: 'unavailable' });
    });

    it('keeps mixed partial-source bootstrap polling non-terminal', () => {
        const analysis = normalizeAnalysis({
            trackingExists: true,
            analysisPhase: 'BOOTSTRAPPING',
            analysisBootstrapStatus: 'PARTIAL',
            analysisScopes: [
                { scope: 'normal', bootstrapStatus: 'RUNNING', capabilityStatus: 'PARTIAL', progress: 42 },
                { scope: 'war', bootstrapStatus: 'PARTIAL', capabilityStatus: 'PARTIAL' },
                { scope: 'ranked', bootstrapStatus: 'UNSUPPORTED', capabilityStatus: 'UNSUPPORTED' }
            ]
        });

        expect(analysis).toMatchObject({ phase: 'FETCHING', active: true, ready: false });
        expect(analysis.scopes.normal).toMatchObject({ phase: 'PROCESSING', active: true });
        expect(analysis.scopes.war).toMatchObject({ phase: 'PARTIAL', ready: true });
        expect(analysis.scopes.ranked).toMatchObject({ phase: 'UNSUPPORTED', ready: true });
    });

    it('continues polling when active phase outranks a partial bootstrap status', async () => {
        const initial = { trackingExists: true, analysisPhase: 'BOOTSTRAPPING', analysisBootstrapStatus: 'PARTIAL' };
        let calls = 0;
        const result = await pollHistoryAnalysis({
            initial,
            fetchStatus: async () => (++calls === 1 ? initial : { trackingExists: true, analysisPhase: 'READY' }),
            interval: 0
        });

        expect(calls).toBe(2);
        expect(result).toMatchObject({ phase: 'READY', ready: true });
    });

    it('does not infer missing scope phases from the overall phase', () => {
        const analysis = normalizeAnalysis({
            analysisPhase: 'FETCHING',
            analysisScopes: { normal: { status: 'FETCHING', progress: 20 } }
        });

        expect(analysis.scopes.normal).toMatchObject({ phase: 'FETCHING', active: true, progress: 20 });
        expect(analysis.scopes.war).toMatchObject({ phase: 'UNKNOWN', active: false, progress: null });
        expect(analysis.scopes.ranked).toMatchObject({ phase: 'UNKNOWN', active: false });
    });

    it('surfaces a compact-status read failure as retryable analysis error', () => {
        expect(normalizeAnalysis({
            trackingExists: true,
            status: 'ACTIVE',
            analysisPhase: 'UNKNOWN',
            analysisErrorCode: 'STATUS_UNAVAILABLE'
        })).toMatchObject({ phase: 'UNKNOWN', error: true, retryable: true, errorCode: 'STATUS_UNAVAILABLE' });
    });

    it('polls until the backend reports ready and forwards every status update', async () => {
        const responses = [
            { trackingExists: true, status: 'ACTIVE', analysisPhase: 'PROCESSING', phaseProgress: 70 },
            { trackingExists: true, status: 'ACTIVE', analysisPhase: 'READY', phaseProgress: 100 }
        ];
        const phases = [];
        const result = await pollHistoryAnalysis({
            initial: { trackingExists: true, status: 'ACTIVE', analysisPhase: 'QUEUED', phaseProgress: 0 },
            fetchStatus: async () => responses.shift(),
            interval: 0,
            onUpdate: (_, analysis) => phases.push(analysis.phase)
        });

        expect(phases).toEqual(['PROCESSING', 'READY']);
        expect(result).toMatchObject({ phase: 'READY', ready: true, progress: 100 });
    });
});
