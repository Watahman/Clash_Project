import { beforeEach, describe, expect, it } from 'vitest';
import { renderOptimizePlanPreview } from '../../src/assets/js/cwl/optimize-plan/cwl-optimize-plan-renderer.js?v=20260829-public-auth-v1';

describe('CWL Optimize Plan preview', () => {
    beforeEach(() => {
        localStorage.setItem('clashtools_language', 'en');
        document.body.innerHTML = '<div id="preview"></div>';
    });

    it('shows the comparison, reasons and individual suggestion controls', () => {
        const result = previewResult();
        renderOptimizePlanPreview({
            container: document.querySelector('#preview'),
            result,
            acceptedIds: new Set(['opt-001']),
            ignoredIds: new Set()
        });

        expect(document.querySelector('.cwl-optimize-summary').textContent)
            .toBe('1 improvement found');
        expect(document.querySelector('.cwl-optimize-comparison').textContent)
            .toContain('31.9★');
        expect(document.querySelector('.cwl-optimize-comparison').textContent)
            .toContain('32.8★');
        expect(document.querySelector('.cwl-optimize-suggestion').textContent)
            .toContain('Liam → Core');
        expect(document.querySelector('.cwl-optimize-suggestion').textContent)
            .toContain('+8 expected performance');
        expect(document.querySelector('[data-optimize-action="accept"]')
            .getAttribute('aria-pressed')).toBe('true');
    });

    it('shows when a risky clan has no safe optimization', () => {
        const result = previewResult();
        result.suggestions = [];
        result.clanAdvice.alpha = { status: 'no-safe-optimization', suggestionIds: [] };

        renderOptimizePlanPreview({
            container: document.querySelector('#preview'),
            result,
            acceptedIds: new Set(),
            ignoredIds: new Set()
        });

        expect(document.querySelector('.cwl-optimize-empty').textContent)
            .toContain('No safe optimization available');
        expect(document.querySelectorAll('[data-optimize-action]')).toHaveLength(0);
    });
});

function previewResult() {
    return {
        comparison: {
            current: {
                expectedPerformance: 31.9,
                reliability: 93,
                lineupChanges: 11,
                readiness: 'risk'
            },
            optimized: {
                expectedPerformance: 32.8,
                reliability: 97,
                lineupChanges: 5,
                readiness: 'good'
            },
            playerChanges: 2
        },
        current: {
            clans: [{
                id: 'alpha',
                name: 'Alpha',
                league: 'Master League I',
                capacity: 15,
                readiness: { status: 'risk' }
            }]
        },
        suggestions: [{
            id: 'opt-001',
            type: 'role-swap',
            clanIds: ['alpha'],
            title: { code: 'role', playerName: 'Liam', role: 'core' },
            actions: [],
            reasons: [
                { code: 'performance', value: 8 },
                { code: 'reliability', from: 76, to: 98 }
            ]
        }],
        clanAdvice: {
            alpha: { status: 'changes', suggestionIds: ['opt-001'] }
        }
    };
}
