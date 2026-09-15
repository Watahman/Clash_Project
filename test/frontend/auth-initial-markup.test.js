import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const pages = [
    ['src/subpages/login.html', ['email', 'password', 'submit-button', 'forgot-password', 'google-login']],
    ['src/subpages/register.html', ['username', 'email', 'password', 'password2', 'submit-button', 'google-login']]
];

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('auth initial markup safety', () => {
    it.each(pages)('%s keeps every auth control inert until session resolution', (path, controlIds) => {
        const document = documentFor(path);
        const form = document.querySelector('#auth-form');

        expect(form).not.toBeNull();
        expect(form.hasAttribute('inert')).toBe(true);
        expect(form.getAttribute('aria-busy')).toBe('true');
        for (const id of controlIds) {
            expect(document.querySelector(`#${id}`), id).toHaveProperty('disabled', true);
        }
    });

    it.each(pages)('%s presents a neutral session-checking status', path => {
        const status = documentFor(path).querySelector('#auth-status');

        expect(status).not.toBeNull();
        expect(status.getAttribute('role')).toBe('status');
        expect(status.getAttribute('aria-live')).toBe('polite');
        expect(status.getAttribute('data-i18n')).toBe('auth.checkingSession');
        expect(status.textContent.trim()).toBe('Checking your session...');
        expect(status.dataset.state || '').not.toMatch(/^(error|success)$/);
    });
});
