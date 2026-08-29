import { beforeEach, describe, expect, it } from 'vitest';
import {
    initDesktopSidebar,
    initMobileSidebar
} from '../../src/assets/js/shell/workspace-sidebar.js?v=20260829-public-auth-v1';

function desktopSidebar() {
    document.body.innerHTML = `
        <aside id="workspace-sidebar">
            <button id="workspace-sidebar-toggle" aria-expanded="true"></button>
            <nav><a data-workspace-nav><span>Dashboard</span></a></nav>
            <a id="profile-btn"><span>Profile</span></a>
        </aside>`;
    return document.querySelector('#workspace-sidebar');
}

function mobileSidebar() {
    document.body.innerHTML = `
        <button id="workspace-mobile-menu" aria-expanded="false"></button>
        <aside id="workspace-sidebar"><a href="/app/profile">Profile</a></aside>
        <button class="workspace-sidebar-backdrop"></button>`;
    return {
        sidebar: document.querySelector('#workspace-sidebar'),
        backdrop: document.querySelector('.workspace-sidebar-backdrop')
    };
}

describe('workspace sidebar controls', () => {
    beforeEach(() => {
        document.body.className = 'workspace-app';
        localStorage.clear();
    });

    it('persists desktop collapse state and updates accessible state', () => {
        const sidebar = desktopSidebar();
        initDesktopSidebar(sidebar);

        sidebar.querySelector('#workspace-sidebar-toggle').click();

        expect(document.body.classList.contains('workspace-sidebar-collapsed')).toBe(true);
        expect(localStorage.getItem('clashtools_workspace_sidebar_collapsed')).toBe('true');
        expect(sidebar.querySelector('#workspace-sidebar-toggle').getAttribute('aria-expanded')).toBe('false');
        expect(sidebar.querySelector('[data-workspace-nav]').title).toBe('Dashboard');
    });

    it('opens and closes the mobile drawer through its supported controls', () => {
        const { sidebar, backdrop } = mobileSidebar();
        initMobileSidebar(sidebar, backdrop);
        const button = document.querySelector('#workspace-mobile-menu');

        button.click();
        expect(sidebar.classList.contains('is-open')).toBe(true);
        expect(backdrop.classList.contains('is-open')).toBe(true);
        expect(button.getAttribute('aria-expanded')).toBe('true');

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(sidebar.classList.contains('is-open')).toBe(false);
        expect(backdrop.classList.contains('is-open')).toBe(false);
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });
});
