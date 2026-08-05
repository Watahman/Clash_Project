import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ensureLanguage, translations } from '../../src/assets/js/i18n/runtime-translations.js';

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('public and profile consistency fixes', () => {
    it('keeps public pages independent from the stored or device theme', () => {
        const themeManager = read('src/assets/js/theme/theme-manager.js');
        expect(themeManager).toContain("isPublicPage() ? 'dark'");
    });

    it('uses one square inset image rule for every public feature page', () => {
        const css = read('src/assets/css/public-consistency-fixes.css');
        expect(css).toContain('aspect-ratio: 1 / 1');
        expect(css).toContain('body.public-site .home-v2-artwork .home-v2-artwork-inset');
    });

    it('keeps the profile language menu in normal flow below its button', () => {
        const css = read('src/assets/css/profile-language-fixes.css');
        expect(css).toContain('position: static');
        expect(css).toContain('.language-switcher--profile .language-switcher-menu');
    });


    it('does not use Dutch as a non-Dutch workspace fallback', () => {
        const shell = read('src/assets/js/shell/workspace-shell.js');
        const groupTemplates = read('src/assets/js/templates/GroupTemplates.js');
        const planSchema = read('src/assets/js/cwl/cwl-plan-schema.js');

        expect(shell).not.toContain('Applicatienavigatie');
        expect(shell).not.toContain('>Taal</button>');
        expect(groupTemplates).toContain("document.documentElement.lang || 'en'");
        expect(planSchema).toContain("t('cwl.accountAlreadyInPlanner')");
    });
});

describe('runtime locale completeness', () => {
    const dutchLeakPattern = /\b(?:geen|opslaan|verwijderen|toevoegen|sluiten|annuleren|speler|spelers|aanval|aanvallen|instellingen|vrienden|beschikbaar|wachtwoord|gebruikersnaam|meldingen|volgende|vorige|vandaag|gisteren|kies|zoeken|overzicht|bewerken|wordt|worden)\b|\bnog geen\b|\bprobeer opnieuw\b/iu;

    for (const language of ['fr', 'de', 'es']) {
        it(`${language} contains every runtime key and no obvious Dutch leakage`, async () => {
            const dictionary = await ensureLanguage(language);
            const englishKeys = Object.keys(translations.en).sort();

            expect(Object.keys(dictionary).sort()).toEqual(englishKeys);
            for (const [key, value] of Object.entries(dictionary)) {
                expect(String(value).trim(), `${language}:${key}`).not.toBe('');
                expect(dutchLeakPattern.test(String(value)), `${language}:${key}`).toBe(false);
            }
        });
    }
});
