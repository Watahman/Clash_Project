import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { translations } from '../../src/assets/js/i18n/translations.js';
import { initProfileSettings } from '../../src/assets/js/profile/profile_settings.js';

describe('Part 6 bracket workspace', () => {
    it('separates setup from the generated result while keeping every bracket action', () => {
        const html = readFileSync('src/subpages/bracket-generator.html', 'utf8');

        expect(html).toContain('class="bracket-setup"');
        expect(html).toContain('class="bracket-result"');
        [
            'bracket-name', 'bracket-participants', 'bracket-generate-seeded',
            'bracket-generate-shuffled', 'bracket-import', 'bracket-export',
            'bracket-reset', 'bracket-board'
        ].forEach(id => expect(html).toContain(`id="${id}"`));
        expect(html).not.toMatch(/bracket-(?:mobile|previous-round|next-round)/);
    });

    it('labels dynamic winner controls as pressed or unpressed', () => {
        const renderer = readFileSync('src/assets/js/bracket/bracket-renderer.js', 'utf8');
        const source = readFileSync('src/assets/js/bracket/bracket-page-controller.js', 'utf8');
        expect(renderer).toContain("button.setAttribute('aria-pressed'");
        expect(source).toContain('setMatchWinner(this.state.bracket, match.id, player)');
    });
});

describe('Part 6 profile and settings', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
    });

    it('uses a reusable fragment with unique controls, safe image sources and all approved tabs', () => {
        const html = readFileSync('src/subpages/popup_htmls/profile_popup.html', 'utf8');
        const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);

        expect(html).not.toMatch(/<!doctype|<html|<head|<body/i);
        expect(html).not.toContain('src=""');
        expect(new Set(ids).size).toBe(ids.length);
        expect([...html.matchAll(/class="po-tab(?: [^"]*)?"/g)]).toHaveLength(4);
        expect(html).toContain('id="po-settings-language-button"');
        expect(html).toContain('id="po-loading-state"');
    });

    it('keeps friend and add dialogs centered without legacy global overlay styles', () => {
        const html = readFileSync('src/subpages/popup_htmls/profile_popup.html', 'utf8');
        const css = readFileSync('src/assets/css/profile-overlay.css', 'utf8');

        expect(html).toContain('id="po-friend-list" role="dialog" aria-modal="true"');
        expect(css).toMatch(/\.profile-placeholder > \.overlay\s*\{[^}]*position:\s*fixed;/s);
        expect(css).toMatch(/\.profile-placeholder > \.overlay\s*\{[^}]*align-items:\s*center;/s);
        expect(css).toMatch(/\.profile-placeholder > \.overlay > \.overlay-container\s*\{[^}]*background:/s);
        expect(css).toContain('.profile-placeholder > .overlay.hidden { display: none; }');
    });

    it('binds setting controls only once when the profile is initialized again', () => {
        document.body.innerHTML = `
            <button class="po-theme-option" data-theme-choice="dark"></button>
            <button class="po-theme-option" data-theme-choice="light"></button>
            <button class="po-theme-option" data-theme-choice="system"></button>
            <button id="po-settings-language-button" type="button"></button>
            <p id="po-settings-message" class="hidden"></p>`;

        initProfileSettings();
        initProfileSettings();

        const dark = document.querySelector('[data-theme-choice="dark"]');
        dark.click();
        expect(dark.dataset.poSettingsBoundTheme).toBe('true');
        expect(dark.getAttribute('aria-pressed')).toBe('true');

        const language = document.querySelector('#po-settings-language-button');
        expect(document.querySelectorAll('[data-language-switcher]')).toHaveLength(1);
        language.querySelector('[data-language-option="en"]').click();
        expect(localStorage.getItem('clashtools_language')).toBe('en');
    });

    it('provides every new label in all supported languages', () => {
        const keys = [
            'bracket.workspaceIntro', 'bracket.setupTitle', 'bracket.resultHelp',
            'profile.profileAccounts', 'profile.accounts', 'settings.language',
            'settings.languageHelp'
        ];
        Object.values(translations).forEach(dictionary => {
            keys.forEach(key => expect(dictionary[key], key).toBeTruthy());
        });
    });
});
