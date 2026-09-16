import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file) => fs.readFileSync(file, 'utf8');

describe('Cloudflare deployment safety', () => {
    it('guards production deploys and verifies the public site after upload', () => {
        const code = read('deploy-cloudflare-production.ps1');
        expect(code).toMatch(/git status --porcelain/i);
        expect(code).toMatch(/git fetch origin master --quiet/i);
        expect(code).toMatch(/origin\/master/i);
        expect(code).toMatch(/npm\.cmd/);
        expect(code).toMatch(/"run", "check"/i);
        expect(code).toMatch(/"deploy", "--dry-run"/i);
        expect(code).toMatch(/API_PROXY_SECRET/);
        expect(code).toMatch(/clashpanel\.com\/api\/health/i);
        expect(code).toMatch(/clashpanel\.com\/api\/ready/i);
    });

    it('keeps production cron-free and bound only to the custom domain', () => {
        const config = JSON.parse(read('wrangler.jsonc'));
        expect(config.name).toBe('clashpanel');
        expect(config.workers_dev).toBe(false);
        expect(config.preview_urls).toBe(false);
        expect(config.triggers?.crons ?? []).toEqual([]);
        expect(config.routes).toContainEqual({ pattern: 'clashpanel.com', custom_domain: true });
    });
    it('refuses a stale Phase 8 callback mutation that could inherit production config', () => {
        const code = read('deploy-phase8-preview.ps1');
        expect(code).toMatch(/git fetch origin Development --quiet/i);
        expect(code).toMatch(/Get-TaggedRevisionJson/);
        expect(code).toMatch(/CandidateRevision\.spec\.containers/);
        expect(code).toMatch(/request-based CPU billing/i);
        expect(code).toMatch(/latestCreatedRevisionName/);
        expect(code).toMatch(/tagged candidate is not the latest created revision/i);
        expect(code).toMatch(/service-account=clashpanel-api-runtime@\$ProjectId\.iam\.gserviceaccount\.com/i);
        expect(code).toMatch(/Assert-Phase8StillSafe[\s\S]*CandidateRevision/i);
    });

    it('has no scheduled Worker handler that could wake Cloud Run', () => {
        const worker = read('worker/index.js');
        expect(worker).not.toMatch(/\bscheduled\s*\(/i);
    });
});
