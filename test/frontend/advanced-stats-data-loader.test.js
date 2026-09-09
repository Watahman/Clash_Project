import { describe, expect, it, vi } from 'vitest';
import {
    loadMoreBattles,
    loadStatistics,
    resetBattleHistoryState
} from '../../src/assets/js/pages/advanced-stats-data-loader.js?v=20260909-battledata-v1';

function createState(battlesResponse) {
    return {
        api: {
            getOverview: vi.fn().mockResolvedValue({}),
            getUnits: vi.fn().mockResolvedValue({ items: [] }),
            getArmies: vi.fn().mockResolvedValue({ items: [] }),
            getTrends: vi.fn().mockResolvedValue({ points: [] }),
            getBattles: vi.fn().mockResolvedValue(battlesResponse)
        },
        playerTag: '#PLAYER',
        period: '30d',
        category: 'ALL',
        unitCatalog: [],
        battles: [],
        nextCursor: null,
        hasMore: false,
        busy: false,
        requestVersion: 1,
        sectionStates: { summary: 'idle', units: 'idle', armies: 'idle', trends: 'idle', battles: 'idle' }
    };
}

const callbacks = () => ({
    setBusy: vi.fn(),
    setDataStatus: vi.fn(),
    renderPage: vi.fn()
});

describe('Advanced Stats battle history loader', () => {
    it('clears an unavailable state before another account or period is loaded', () => {
        const state = createState({ items: [] });
        state.battles = [{ id: 'old' }];
        state.nextCursor = 'old-cursor';
        state.hasMore = true;
        state.battleHistoryUnsupported = true;
        state.battleHistoryUnsupportedReason = 'raw_attack_history_not_retained';

        resetBattleHistoryState(state);

        expect(state.battles).toEqual([]);
        expect(state.nextCursor).toBeNull();
        expect(state.hasMore).toBe(false);
        expect(state.battleHistoryUnsupported).toBe(false);
        expect(state.battleHistoryUnsupportedReason).toBeNull();
    });

    it('preserves the unsupported response instead of presenting an empty timeline', async () => {
        const state = createState({
            items: [],
            hasMore: false,
            unsupported: true,
            reason: 'raw_attack_history_not_retained'
        });

        await loadStatistics({ state, requestVersion: 1, ...callbacks() });

        expect(state.battleHistoryUnsupported).toBe(true);
        expect(state.battleHistoryUnsupportedReason).toBe('raw_attack_history_not_retained');
        expect(state.battles).toEqual([]);
        expect(state.nextCursor).toBeNull();
        expect(state.hasMore).toBe(false);
    });

    it('clears unsupported state when retained battle history is available', async () => {
        const state = createState({ items: [], hasMore: false });
        state.battleHistoryUnsupported = true;

        await loadStatistics({ state, requestVersion: 1, ...callbacks() });

        expect(state.battleHistoryUnsupported).toBe(false);
        expect(state.battleHistoryUnsupportedReason).toBeNull();
    });

    it('stops pagination if a later page reports unsupported history', async () => {
        const state = createState({
            items: [],
            unsupported: true,
            reason: 'raw_attack_history_not_retained'
        });
        state.nextCursor = 'cursor-1';
        state.battleHistoryUnsupported = false;
        const callbacksForMore = callbacks();

        await loadMoreBattles({ state, ...callbacksForMore });

        expect(state.api.getBattles).toHaveBeenCalledWith('#PLAYER', '30d', {
            limit: 20,
            cursor: 'cursor-1'
        });
        expect(state.battleHistoryUnsupported).toBe(true);
        expect(state.battleHistoryUnsupportedReason).toBe('raw_attack_history_not_retained');
        expect(state.nextCursor).toBeNull();
        expect(state.hasMore).toBe(false);
    });
});
