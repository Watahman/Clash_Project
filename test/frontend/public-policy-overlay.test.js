import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initPublicPolicyOverlay } from '../../src/assets/js/pages/public-policy-overlay.js?v=20260829-public-auth-v1';

function mountPolicy(page) {
    document.body.innerHTML = `<main><article data-policy-document="${page}"></article></main>`;
}

describe('public policy translation overlay', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('renders the complete French privacy policy', async () => {
        localStorage.setItem('clashtools_language', 'fr');
        mountPolicy('privacy');
        initPublicPolicyOverlay();
        await vi.runAllTimersAsync();

        const root = document.querySelector('[data-policy-document]');
        expect(root.dataset.renderedLanguage).toBe('fr');
        expect(root.querySelector('h1')?.textContent).toBe('Politique de confidentialité');
        expect(root.querySelectorAll(':scope > section').length).toBeGreaterThanOrEqual(10);
        expect(root.querySelector('.policy-toc')?.getAttribute('aria-label')).toBe('Sommaire');
    });

    it('renders a translated Spanish contact form', async () => {
        localStorage.setItem('clashtools_language', 'es');
        mountPolicy('contact');
        initPublicPolicyOverlay();
        await vi.runAllTimersAsync();

        const root = document.querySelector('[data-policy-document]');
        expect(root.querySelector('h1')?.textContent).toBe('Contacto');
        expect(root.querySelector('.feedback-form-section h2')?.textContent).toBe('Enviar comentarios');
        expect(root.querySelector('button[type="submit"]')?.textContent).toBe('Enviar comentarios');
    });
});
