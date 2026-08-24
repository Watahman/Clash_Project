import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const privacy = readFileSync('src/subpages/privacy.html', 'utf8');
const terms = readFileSync('src/subpages/terms.html', 'utf8');

describe('Advanced Stats policy disclosures', () => {
    it('describes opt-in tracked battle data and its source', () => {
        expect(privacy).toContain('If you choose to start Advanced Stats for a linked account');
        expect(privacy).toContain('periodically requests available battle-log data');
        expect(privacy).toContain('does not start this personal tracking automatically');
    });

    it('describes pause, stop and destructive delete retention semantics', () => {
        expect(privacy).toContain('pausing or stopping tracking prevents future scheduled collection while preserving the tracked history');
        expect(privacy).toContain('resets achievement progress that is derived exclusively from Advanced Stats tracking');
        expect(privacy).toContain('unrelated achievement progress is preserved');
    });

    it('does not promise reconstructed or complete upstream history', () => {
        expect(terms).toContain('does not promise to reconstruct a player\'s complete history');
        expect(terms).toContain('first-observed time and stable battle content');
        expect(terms).toContain('possible gaps rather than being described as complete data');
    });

    it('keeps feature-level deletion behavior explicit in the terms', () => {
        expect(terms).toContain('destructive Advanced Stats delete action removes the saved tracker/history');
        expect(terms).toContain('unrelated achievement progress is not removed');
    });
});
