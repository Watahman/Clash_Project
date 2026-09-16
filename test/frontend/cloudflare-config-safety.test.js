import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => fs.readFileSync(file, 'utf8');

describe('Cloudflare configuration safety', () => {
    it('keeps production cron-free and bound only to the custom domain', () => {
        const config = JSON.parse(read('wrangler.jsonc'));
        expect(config.name).toBe('clashpanel');
        expect(config.workers_dev).toBe(false);
        expect(config.preview_urls).toBe(false);
        expect(config.triggers?.crons ?? []).toEqual([]);
        expect(config.routes).toContainEqual({ pattern: 'clashpanel.com', custom_domain: true });
        expect(config.vars.CLOUD_RUN_ORIGIN).toMatch(/^https:\/\/.+\.run\.app\/?$/);
        expect(config.vars.CLOUD_RUN_ORIGIN).not.toMatch(/phase8/i);
        expect(config.vars.PREVIEW_PROGRESS_ACCESS_ENABLED).toBeUndefined();
        expect(config.vars.PREVIEW_PROGRESS_TESTER_EMAIL).toBeUndefined();
    });

    it('keeps the Git-deployed preview isolated from the production domain', () => {
        const config = JSON.parse(read('wrangler.preview.jsonc'));
        expect(config.workers_dev).toBe(true);
        expect(config.routes ?? []).toEqual([]);
        expect(config.triggers?.crons ?? []).toEqual([]);
        expect(config.vars.DISABLE_CANONICAL_REDIRECT).toBe('true');
        expect(config.vars.PREVIEW_PROGRESS_ACCESS_ENABLED).toBe('true');
        expect(config.vars.PREVIEW_PROGRESS_TESTER_EMAIL).toBe('emile.vandewaetere@gmail.com');
        expect(config.vars.UPSTREAM_ORIGIN_OVERRIDE).toBe('https://clashpanel.com');
        expect(config.vars.CLOUD_RUN_ORIGIN).toMatch(/^https:\/\/phase8---clashpanel-api-.+\.a\.run\.app$/);
    });

    it('has no scheduled Worker handler that could wake Cloud Run', () => {
        const worker = read('worker/index.js');
        expect(worker).not.toMatch(/\bscheduled\s*\(/i);
    });
});
