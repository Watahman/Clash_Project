import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const adLoader = '/assets/js/Data/ads.js?v=20260916-infolinks-v1';
const eligibleFiles = Object.freeze([
    'src/index.html',
    'src/guides.html',
    'src/methodology.html',
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
    'src/bracket-generator.html',
    'src/about.html',
    'src/guides/cwl-attack-defense.html',
    'src/guides/cwl-availability.html',
    'src/guides/cwl-bonus-medals.html',
    'src/guides/cwl-rotation.html',
    'src/guides/cwl-season-history.html',
    'src/guides/fair-cwl-roster.html',
    'src/guides/missed-attacks.html',
    'src/guides/spreadsheet-vs-cwl-planner.html'
]);
const excludedFiles = Object.freeze([
    'src/404.html',
    'src/advanced-stats.html',
    'src/achievements.html',
    'src/changelog.html',
    'src/minigames.html',
    'src/subpages/achievements.html',
    'src/subpages/advanced-stats.html',
    'src/subpages/bracket-generator.html',
    'src/subpages/cwl-operation-board.html',
    'src/subpages/cwl-planner-drafts.html',
    'src/subpages/cwl-planner.html',
    'src/subpages/dashboard.html',
    'src/subpages/explore.html',
    'src/subpages/groups.html',
    'src/subpages/minigames.html',
    'src/subpages/war-operation-board.html',
    'src/subpages/contact.html',
    'src/subpages/cookies.html',
    'src/subpages/login.html',
    'src/subpages/privacy.html',
    'src/subpages/profile.html',
    'src/subpages/register.html',
    'src/subpages/terms.html'
]);

describe('Ad route eligibility', () => {
    it('keeps the source HTML inventory exactly aligned with the allowlist', () => {
        expect(listHtmlFiles('src')).toEqual([...eligibleFiles, ...excludedFiles].sort());
    });

    it.each(eligibleFiles)('%s imports the versioned central ad manager once', file => {
        const source = readFileSync(file, 'utf8');
        const tags = scriptTags(source).filter(tag => tag.src === adLoader);

        expect(tags).toHaveLength(1);
        expect(tags[0].source).toMatch(/\bdefer\b/);
    });

    it.each(excludedFiles)('%s never imports the central ad manager', file => {
        expect(readFileSync(file, 'utf8')).not.toContain('/assets/js/Data/ads.js');
    });

    it('keeps consent and route eligibility in one central manager', () => {
        const source = [
            readFileSync('src/assets/js/Data/ads.js', 'utf8'),
            readFileSync('src/assets/js/Data/infolinks-manager.js', 'utf8')
        ].join('\n');

        expect(source).toMatch(/(?:eligible|allowlist)/i);
        expect(source).toMatch(/(?:consent|adStorage|advertisingConsent)/i);
        expect(source).toMatch(/(?:hasAdvertisingConsent|ad-consent-changed)/i);
        expect(source).toContain('initInfolinksAds');
    });

    it('keeps the supplied account integration in one central configuration', () => {
        const source = readFileSync('src/assets/js/Data/infolinks-config.js', 'utf8');

        expect(source).toContain('const PUBLIC_AD_ELIGIBLE_ROUTES');
        expect(source).toContain('const HARD_EXCLUDED_PREFIXES');
        expect(source).toContain('enabled: true');
        expect(source).toContain("src: 'https://resources.infolinks.com/js/infolinks_main.js'");
        expect(source).toContain('initialization');
        expect(source).toContain('infolinks_pid: 3447886');
        expect(source).toContain('infolinks_wsid: 0');
    });
});

function scriptTags(source) {
    return [...source.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
        .map(match => ({ source: match[0], src: match[1] }));
}

function listHtmlFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) return listHtmlFiles(file);
        return file.endsWith('.html') ? [file.replaceAll('\\', '/')] : [];
    }).sort();
}
