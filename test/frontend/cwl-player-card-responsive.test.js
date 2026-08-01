import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/assets/css/cwl-player-card.css', 'utf8').replaceAll('\r\n', '\n');
const mobileCss = css.slice(css.indexOf('@media (max-width: 46rem)'));

describe('CWL player card responsive contract', () => {
    it('keeps every planner card and direct child inside its container', () => {
        expect(css).toContain('min-width: 0;\n    max-width: 100%;\n    min-height: 4rem');
        expect(css).toContain('.workspace-planner .cwl-player-article > * {\n    min-width: 0;\n    max-width: 100%;');
        expect(css).toContain('.workspace-planner .cwl-player-info > * {\n    display: block;\n    width: 100%;\n    max-width: 100%;');
        expect(css).toContain('.workspace-planner .cwl-player-control-group > select {\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;');
    });

    it('gives mobile player information, availability and controls separate rows', () => {
        expect(mobileCss).toContain('grid-template-columns: 2.35rem minmax(0, 1fr) 2.75rem !important;');
        expect(mobileCss).toContain('grid-column: 2;\n        grid-row: 2;\n        max-width: 100%;');
        expect(mobileCss).toContain('grid-column: 1 / -1;\n        grid-row: 3;\n        width: 100%;');
        expect(mobileCss).toContain('grid-column: 3;\n        grid-row: 1;\n        width: 2.75rem;');
    });

    it('stacks both clan controls at narrow phone widths', () => {
        expect(mobileCss).toContain('@media (max-width: 34rem) {\n    .workspace-planner .cwl-clan-player-list .cwl-player-control-group {\n        grid-template-columns: minmax(0, 1fr);');
    });
});
