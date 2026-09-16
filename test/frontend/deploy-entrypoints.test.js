import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => fs.readFileSync(file, 'utf8');

describe('one-command deployment entrypoints', () => {
    it('pushes Development and deploys only the Google Cloud preview', () => {
        const code = read('deploy-dev.ps1');
        expect(code).toMatch(/Development/);
        expect(code).toMatch(/npm\.cmd run check/);
        expect(code).toMatch(/push origin HEAD:Development/);
        expect(code).toMatch(/deploy-cloud-run-preview\.ps1/);
        expect(code).toMatch(/PreviewOrigin/);
        expect(code).not.toMatch(/deploy-cloudflare-preview\.ps1/);
        expect(code).toMatch(/Cloudflare will deploy from Git automatically/);
    });

    it('fast-forwards the tested Development commit to master and deploys Cloud Run production', () => {
        const code = read('deploy-prod.ps1');
        expect(code).toMatch(/HEAD is not the pushed Development commit/);
        expect(code).toMatch(/merge-base --is-ancestor origin\/master HEAD/);
        expect(code).toMatch(/npm\.cmd run check/);
        expect(code).toMatch(/push origin HEAD:master/);
        expect(code).toMatch(/deploy-cloud-run-production\.ps1/);
        expect(code).toMatch(/AllowAdvancedStatsCollectionDisabled/);
        expect(code).not.toMatch(/deploy-cloudflare-production\.ps1/);
        expect(code).toMatch(/Cloudflare will deploy production from Git automatically/);
    });
});
