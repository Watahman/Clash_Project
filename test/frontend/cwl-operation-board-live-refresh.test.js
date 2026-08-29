import { describe, expect, it, vi } from 'vitest';
import { createCwlOperationBoardReportLoader } from '../../src/assets/js/operation-board/cwl-operation-board-report-loader.js?v=20260829-public-auth-v1';

describe('CWL Operation Board live refresh', () => {
    it('passes an explicit force-refresh request to the live source', async () => {
        const loadSource = vi.fn().mockResolvedValue({
            clan: { tag: '#CLAN' },
            fixture: false
        });
        const loader = createCwlOperationBoardReportLoader({
            getSelectedPlan: () => null,
            getHistoryController: () => null,
            setSelectedClan: vi.fn(),
            setCurrentReport: vi.fn(),
            getCurrentReport: () => null,
            setLatestReport: vi.fn(),
            getLatestReport: () => null,
            setState: vi.fn(),
            setHelp: vi.fn(),
            clearReport: vi.fn(),
            renderLatestReport: vi.fn(),
            renderPhase: vi.fn(),
            loadSource,
            makeReport: () => ({ wars: [] }),
            enrichReport: vi.fn()
        });

        await loader.refreshClanReport({ tag: '#CLAN' }, true);

        expect(loadSource).toHaveBeenCalledWith(expect.objectContaining({
            clan: { tag: '#CLAN' },
            forceRefresh: true,
            signal: expect.any(AbortSignal)
        }));
    });
});
