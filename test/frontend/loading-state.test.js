import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    startGlobalLoading,
    stopGlobalLoading,
    withGlobalLoading
} from '../../src/assets/js/utils/loading-state.js?v=20260829-public-auth-v1';

describe('global loading state', () => {
    beforeEach(() => {
        document.body.replaceChildren();
        document.documentElement.classList.remove('global-loading-active');
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('does not flash for quick blocking work', async () => {
        const promise = withGlobalLoading(() => Promise.resolve('done'));
        await expect(promise).resolves.toBe('done');
        vi.advanceTimersByTime(200);
        expect(document.querySelector('#global-loading-overlay').classList.contains('hidden')).toBe(true);
        expect(document.documentElement.classList.contains('global-loading-active')).toBe(false);
    });

    it('keeps nested blocking work visible until the final stop', () => {
        startGlobalLoading('one');
        startGlobalLoading('two');
        vi.advanceTimersByTime(200);
        expect(document.querySelector('#global-loading-overlay').classList.contains('hidden')).toBe(false);
        stopGlobalLoading();
        expect(document.querySelector('#global-loading-overlay').classList.contains('hidden')).toBe(false);
        stopGlobalLoading();
        expect(document.querySelector('#global-loading-overlay').classList.contains('hidden')).toBe(true);
    });
});
