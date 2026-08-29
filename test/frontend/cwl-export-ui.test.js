import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getCurrentPlanSnapshot: vi.fn(),
    renderCwlExportTemplate: vi.fn(),
    fitCwlExportPreview: vi.fn(),
    downloadCwlExportPng: vi.fn(() => Promise.resolve()),
    downloadCwlExportWorkbook: vi.fn(() => Promise.resolve())
}));

vi.mock('../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1', () => ({
    getCurrentPlanSnapshot: mocks.getCurrentPlanSnapshot
}));
vi.mock('../../src/assets/js/cwl/export/cwl-export-renderer.js?v=20260821-badge-v2', () => ({
    renderCwlExportTemplate: mocks.renderCwlExportTemplate,
    fitCwlExportPreview: mocks.fitCwlExportPreview,
    downloadCwlExportPng: mocks.downloadCwlExportPng
}));
vi.mock('../../src/assets/js/cwl/export/cwl-export-xlsx.js', () => ({
    downloadCwlExportWorkbook: mocks.downloadCwlExportWorkbook
}));

describe('CWL export controller', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        localStorage.setItem('clashtools_language', 'en');
        document.body.innerHTML = markup();
        mocks.getCurrentPlanSnapshot.mockReturnValue(snapshot());
        mocks.renderCwlExportTemplate.mockImplementation(() => {
            const preview = document.createElement('div');
            preview.className = 'cwl-export-template';
            preview.textContent = 'export preview';
            return preview;
        });
    });

    it('takes one snapshot per open and shares it between PNG and Excel exports', async () => {
        const opener = document.querySelector('#cwl-export-plan-button');
        const { initCwlPlanExport } = await import(
            '../../src/assets/js/cwl/export/cwl-export-ui.js?v=20260829-public-auth-v1'
        );
        initCwlPlanExport();

        opener.focus();
        opener.click();
        await vi.waitFor(() => expect(mocks.renderCwlExportTemplate).toHaveBeenCalled());

        expect(mocks.getCurrentPlanSnapshot).toHaveBeenCalledOnce();
        expect(document.querySelector('#cwl-export-dialog').hasAttribute('open')).toBe(true);
        expect(document.querySelector('#cwl-export-download-png').disabled).toBe(false);
        expect(document.querySelector('#cwl-export-download-excel').disabled).toBe(false);

        const fitCalls = mocks.fitCwlExportPreview.mock.calls.length;
        window.dispatchEvent(new Event('resize'));
        expect(mocks.fitCwlExportPreview.mock.calls.length).toBeGreaterThan(fitCalls);

        document.querySelector('input[name="cwl-export-scope"][value="clan"]').click();
        document.querySelector('[data-cwl-export-toggle="tags"]').click();
        await vi.waitFor(() => expect(mocks.renderCwlExportTemplate.mock.calls.length).toBeGreaterThan(1));
        expect(mocks.getCurrentPlanSnapshot).toHaveBeenCalledOnce();

        document.querySelector('#cwl-export-download-png').click();
        await vi.waitFor(() => {
            expect(mocks.downloadCwlExportPng).toHaveBeenCalledOnce();
        });
        document.querySelector('#cwl-export-download-excel').click();
        await vi.waitFor(() => expect(mocks.downloadCwlExportWorkbook).toHaveBeenCalledOnce());
        expect(mocks.downloadCwlExportPng.mock.calls[0][0].className)
            .toBe('cwl-export-template');
        expect(mocks.downloadCwlExportWorkbook.mock.calls[0][0])
            .toBe(mocks.getCurrentPlanSnapshot.mock.results[0].value);

        document.querySelector('#cwl-export-dialog').dispatchEvent(
            new Event('cancel', { cancelable: true })
        );
        expect(document.querySelector('#cwl-export-dialog').hasAttribute('open')).toBe(false);
        expect(document.activeElement).toBe(opener);
    });

    it('keeps download actions disabled for an empty plan and announces the empty state', async () => {
        mocks.getCurrentPlanSnapshot.mockReturnValue({ name: 'Empty', clans: [], freePlayers: [] });
        const { initCwlPlanExport } = await import(
            '../../src/assets/js/cwl/export/cwl-export-ui.js?v=20260829-public-auth-v1'
        );
        initCwlPlanExport();
        document.querySelector('#cwl-export-plan-button').click();

        await vi.waitFor(() => expect(document.querySelector('#cwl-export-status').dataset.state).toBe('empty'));
        expect(document.querySelector('#cwl-export-preview-frame').childElementCount).toBe(0);
        expect(document.querySelector('#cwl-export-download-png').disabled).toBe(true);
        expect(document.querySelector('#cwl-export-download-excel').disabled).toBe(true);
    });
});

function markup() {
    return `
        <button id="cwl-export-plan-button">Export plan</button>
        <dialog id="cwl-export-dialog" class="cp-modal cwl-export-dialog">
            <button id="cwl-export-close">Close</button>
            <fieldset class="cwl-export-controls">
                <label><input type="radio" name="cwl-export-scope" value="complete" checked></label>
                <label><input type="radio" name="cwl-export-scope" value="clan"></label>
                <div id="cwl-export-clan-control" hidden><select id="cwl-export-clan-select" disabled></select></div>
                <input type="checkbox" data-cwl-export-toggle="names" checked>
                <input type="checkbox" data-cwl-export-toggle="town-hall" checked>
                <input type="checkbox" data-cwl-export-toggle="tags">
                <input type="checkbox" data-cwl-export-toggle="roles" checked>
            </fieldset>
            <section class="cwl-export-preview"><p id="cwl-export-status"></p><div id="cwl-export-preview-frame"></div></section>
            <footer class="cwl-export-actions">
                <button id="cwl-export-download-png"></button>
                <button id="cwl-export-download-excel"></button>
                <button id="cwl-export-cancel"></button>
            </footer>
        </dialog>`;
}

function snapshot() {
    return {
        name: 'August CWL',
        clans: [
            { id: 'alpha', tag: '#ALPHA', name: 'Alpha', capacity: 15, players: [] },
            { id: 'beta', tag: '#BETA', name: 'Beta', capacity: 15, players: [] }
        ],
        freePlayers: []
    };
}
