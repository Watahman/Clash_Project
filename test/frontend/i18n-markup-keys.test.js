import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTranslationValue } from '../../src/assets/js/i18n/runtime-translations.js?v=20260829-public-auth-v1';

const languages = ['en', 'nl', 'fr', 'de', 'es'];
const files = [
    'src/index.html',
    'src/about.html',
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
    'src/bracket-generator.html',
    'src/subpages/login.html',
    'src/subpages/register.html',
    'src/subpages/dashboard.html'
];

function translationKeys(source) {
    const keys = new Set();
    const pattern = /data-i18n(?:-html|-placeholder|-title|-aria-label)?="([^"]+)"/g;
    let match;
    while ((match = pattern.exec(source))) keys.add(match[1]);
    return [...keys];
}

describe('explicit markup translation keys', () => {
    files.forEach(file => {
        it(`resolves every key used by ${file}`, () => {
            const source = readFileSync(resolve(file), 'utf8');
            const keys = translationKeys(source);
            expect(keys.length).toBeGreaterThan(0);
            keys.forEach(key => {
                languages.forEach(language => {
                    const value = getTranslationValue(language, key);
                    expect(value, `${language}:${key}`).toBeTruthy();
                    expect(value, `${language}:${key}`).not.toBe(key);
                });
            });
        });
    });
});
