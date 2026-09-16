import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('preview configuration', () => {
    it('contains a deployable tagged Cloud Run origin', () => {
        const configPath = path.resolve('wrangler.preview.jsonc');
        const config = fs.readFileSync(configPath, 'utf8');
        const origin = config.match(/"CLOUD_RUN_ORIGIN"\s*:\s*"([^"]+)"/)?.[1];

        expect(origin).toBeTruthy();
        expect(origin).not.toContain('__PHASE8_CANDIDATE_URL__');

        const url = new URL(origin);
        expect(url.protocol).toBe('https:');
        expect(url.hostname).toMatch(/^phase8---clashpanel-api-.+\.a\.run\.app$/);
    });
});
