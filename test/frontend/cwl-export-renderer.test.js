import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/cwl/export/cwl-export-model.js', () => ({
    createCwlExportViewModel(snapshot, options = {}) {
        const single = options.scope === 'single-clan' || options.scope === 'clan';
        const clans = single
            ? snapshot.clans.filter(clan => clan.id === options.clanId)
            : snapshot.clans;
        return {
            name: snapshot.name,
            planName: snapshot.name,
            exportedAt: snapshot.exportedAt,
            clans,
            freePlayers: single ? [] : snapshot.freePlayers,
            visibility: {
                showNames: options.showNames ?? true,
                showTownHall: options.showTownHall ?? true,
                showTags: options.showTags ?? false,
                showRoles: options.showRoles ?? true
            }
        };
    },
    safeExportFilename(value) {
        return String(value).replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }
}));

import {
    downloadCwlExportPng,
    fitCwlExportPreview,
    renderCwlExportTemplate
} from '../../src/assets/js/cwl/export/cwl-export-renderer.js';
import { imageRequestCandidates } from '../../src/assets/js/cwl/export/cwl-export-capture.js';

describe('CWL export renderer', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="target"></div><div id="frame"></div><div id="cwl-all-clans">Planner board</div>';
    });

    it('renders a fixed branded template with full clan rows and unassigned players', () => {
        const canvas = renderCwlExportTemplate(document.querySelector('#target'), snapshot());

        expect(canvas.className).toBe('cwl-export-canvas');
        expect(canvas.dataset.exportWidth).toBe('960');
        expect(canvas.querySelector('.cwl-export-brand').textContent).toContain('CLASHPANEL');
        expect(canvas.querySelectorAll('.cwl-export-clan-card')).toHaveLength(3);
        expect(canvas.querySelectorAll('.cwl-export-player')).toHaveLength(7);
        expect(canvas.querySelector('.cwl-export-unassigned').textContent).toContain('Player Free');
        expect(canvas.textContent).toContain('Player Long with an exceptionally long name');
        expect(canvas.textContent).toContain('Core');
        expect(canvas.querySelector('#cwl-all-clans')).toBeNull();
        expect(document.querySelector('#cwl-all-clans').textContent).toBe('Planner board');
    });

    it('supports single-clan scope and independent visibility flags', () => {
        const canvas = renderCwlExportTemplate(document.querySelector('#target'), snapshot(), {
            scope: 'single-clan',
            clanId: 'beta',
            showNames: false,
            showTownHall: false,
            showTags: true,
            showRoles: false
        });

        expect(canvas.querySelectorAll('.cwl-export-clan-card')).toHaveLength(1);
        expect(canvas.querySelector('.cwl-export-clan-card').dataset.clanId).toBe('beta');
        expect(canvas.querySelector('.cwl-export-unassigned')).toBeNull();
        expect(canvas.querySelectorAll('.cwl-export-townhall')).toHaveLength(0);
        expect(canvas.querySelectorAll('.cwl-export-player-name')).toHaveLength(0);
        expect(canvas.querySelectorAll('.cwl-export-player-tag')).toHaveLength(2);
        expect(canvas.querySelectorAll('.cwl-export-role-badge')).toHaveLength(0);
        expect(canvas.querySelector('.cwl-export-role-counts')).toBeNull();
    });

    it('grows vertically for multi-row clan grids instead of clipping later clans', () => {
        const largeSnapshot = snapshot();
        largeSnapshot.clans.push({
            id: 'delta', name: 'Delta', tag: '#DELTA', capacity: 15,
            players: [player('Six', 'core'), player('Seven', 'rotation')]
        });

        const canvas = renderCwlExportTemplate(document.querySelector('#target'), largeSnapshot);

        expect(canvas.querySelectorAll('.cwl-export-clan-card')).toHaveLength(4);
        expect(Number(canvas.dataset.exportHeight)).toBeGreaterThan(600);
    });

    it('fits the fixed template without changing its logical dimensions', () => {
        const canvas = renderCwlExportTemplate(document.querySelector('#target'), snapshot());
        const frame = document.querySelector('#frame');
        Object.defineProperty(frame, 'clientWidth', { configurable: true, value: 480 });

        expect(fitCwlExportPreview(frame, canvas)).toBe(.5);
        expect(canvas.style.transform).toBe('scale(0.5)');
        expect(frame.dataset.previewScale).toBe('0.5');
        expect(canvas.dataset.exportWidth).toBe('960');
    });

    it('downloads an existing canvas with a safe PNG filename', async () => {
        const source = document.createElement('canvas');
        source.toBlob = callback => callback(new Blob(['png'], { type: 'image/png' }));
        const createUrl = vi.fn(() => 'blob:test');
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        await downloadCwlExportPng(source, { filename: 'ClashPanel-August-CWL.png' });

        expect(createUrl).toHaveBeenCalledOnce();
        expect(click).toHaveBeenCalledOnce();
        expect(document.querySelector('a[download]')).toBeNull();
    });

    it('retries official preview badges through the same-origin export route', () => {
        const badge = 'https://api-assets.clashofclans.com/badges/200/example.png';

        expect(imageRequestCandidates(badge)).toEqual([
            badge,
            `/api/export-assets/clan-badge?url=${encodeURIComponent(badge)}`
        ]);
    });
});

function snapshot() {
    return {
        name: 'August CWL',
        exportedAt: '2026-08-21T12:00:00Z',
        clans: [
            {
                id: 'alpha', name: 'Alpha', tag: '#ALPHA', capacity: 15,
                badgeUrl: '/assets/placeholders/clan-badge.svg',
                players: [player('One', 'core'), player('Long', 'reserve')]
            },
            {
                id: 'beta', name: 'Beta', tag: '#BETA', capacity: 15,
                players: [player('Two', 'rotation'), player('Three', 'core')]
            },
            {
                id: 'gamma', name: 'Gamma', tag: '#GAMMA', capacity: 30,
                players: [player('Four', 'reserve'), player('Five', 'core')]
            }
        ],
        freePlayers: [player('Free', 'reserve')]
    };
}

function player(name, role) {
    const suffix = name === 'Long' ? ' with an exceptionally long name' : '';
    return {
        name: `Player ${name}${suffix}`,
        tag: `#${name.toUpperCase()}`,
        townHallLevel: 18,
        rosterStatus: role
    };
}
