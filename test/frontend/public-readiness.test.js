import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Public production copy', () => {
    const home = readFileSync('src/index.html', 'utf8');
    const policies = readFileSync('src/assets/js/pages/public-policy.js', 'utf8');
    const terms = readFileSync('src/subPages/terms.html', 'utf8');

    it('advertises only features available from the public homepage', () => {
        expect(home).not.toContain('feature-row-coming-soon');
        expect(home).not.toContain('feature-coming-soon-action');
        expect(home).not.toContain('public.bracketDesc');
    });

    it('contains no pre-launch review or draft notices in public policies', () => {
        const publicCopy = `${policies}\n${terms}`;
        [
            'Pre-launch draft',
            'Concept voor pre-launchcontrole',
            'before publication',
            'vóór publicatie',
            'legally reviewed',
            'juridisch controleren',
            'operator review',
            'gecontroleerde code',
            'policy-concept'
        ].forEach(notice => expect(publicCopy).not.toContain(notice));
    });
});
