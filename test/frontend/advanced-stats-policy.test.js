import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publicPolicyExtraLocales } from '../../src/assets/js/i18n/public-policy-extra-locales.js';

const privacy = readFileSync('src/subpages/privacy.html', 'utf8');
const terms = readFileSync('src/subpages/terms.html', 'utf8');
const generatedPolicies = readFileSync('src/assets/js/pages/public-policy.js', 'utf8');

describe('Advanced Stats policy disclosures', () => {
    it('describes opt-in tracked battle data and its source', () => {
        expect(privacy).toContain('If you choose to start Advanced Stats for a linked account');
        expect(privacy).toContain('may request historical battle-log, war-attack and ranked battle-log data');
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

    it('discloses V2 historical provenance in every generated policy language', () => {
        expect(generatedPolicies).toContain('Historical battle-log, war-attack and ranked battle-log records may be supplied by ClashKing V2');
        expect(generatedPolicies).toContain('Historische battlelog-, war-aanvals- en ranked-battleloggegevens');

        Object.values(publicPolicyExtraLocales).forEach(locale => {
            const privacyCopy = locale.privacy.sections.flat(2).join(' ');
            const termsCopy = locale.terms.sections.flat(2).join(' ');
            expect(locale.privacy.description).toMatch(/Advanced.?Stats/);
            expect(privacyCopy).toContain('ClashKing V2');
            expect(termsCopy).toContain('ClashKing V2');
            expect(privacyCopy).toMatch(/partiel|teilweise|parciales/);
        });
    });

    it('separates current official data from partial external history', () => {
        expect(privacy).toContain('Current public player and clan information can be obtained from the official Clash of Clans API');
        expect(privacy).toContain('That external service may return records it has retained from earlier observations');
        expect(terms).toContain('historical battle-log, war-attack and ranked battle-log information used by Advanced Stats may come from ClashKing V2');
        expect(terms).toContain('It does not delete records already retained by an external provider');
    });
});
