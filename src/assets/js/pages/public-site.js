import { initI18n, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { onAuthStateChange } from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { toggleTheme as toggleThemePreference } from '../theme/theme-manager.js?v=20260829-public-header-cta-v1';
import {
    normalizePublicShell,
    updatePublicHeaderAuth
} from '../shell/public-header.js?v=20260829-public-header-cta-v1';
import { ensureThemeToggleMarkup } from '../theme/theme-toggle-markup.js';
import { initPublicPageBindings } from './public-page-bindings.js?v=20260829-public-auth-v1';
import { initPublicResourcePages } from './public-resource-pages.js?v=20260829-public-auth-v1';

function toggleTheme(event) {
    toggleThemePreference(event.currentTarget);
    updateThemeButtons();
}

function updateThemeButtons() {
    const isLight = document.documentElement.dataset.theme === 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        button.setAttribute('aria-pressed', String(isLight));
        button.setAttribute('aria-label', t(isLight ? 'theme.useDark' : 'theme.useLight'));
        button.title = t(isLight ? 'theme.useDark' : 'theme.useLight');
    });
}

function initThemeButtons() {
    ensureThemeToggleMarkup();
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        button.addEventListener('click', toggleTheme);
    });
    updateThemeButtons();
    window.addEventListener('clashtools:theme-changed', updateThemeButtons);
}

function initPublicMenu() {
    const button = document.querySelector('#public-menu');
    const nav = document.querySelector('#public-nav');
    if (!button || !nav) return;

    const actions = document.querySelector('.public-actions');
    const languageSwitcher = actions?.querySelector('[data-language-switcher]');
    const mobileControls = document.createElement('div');
    mobileControls.className = 'public-nav-mobile-controls';
    if (languageSwitcher) nav.append(mobileControls);

    const syncLanguageControl = () => {
        if (!languageSwitcher || !actions) return;
        if (window.matchMedia('(max-width: 70rem)').matches) {
            mobileControls.append(languageSwitcher);
        } else {
            actions.prepend(languageSwitcher);
        }
    };

    const close = () => {
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-label', t('public.openMenu'));
        button.title = t('public.openMenu');
        nav.classList.remove('is-open');
    };
    button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        button.setAttribute('aria-label', t(open ? 'public.closeMenu' : 'public.openMenu'));
        button.title = t(open ? 'public.closeMenu' : 'public.openMenu');
        nav.classList.toggle('is-open', open);
    });
    nav.addEventListener('click', event => {
        if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
    });

    syncLanguageControl();
    window.addEventListener('resize', syncLanguageControl, { passive: true });
    window.addEventListener('clashtools:language-changed', () => {
        const open = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-label', t(open ? 'public.closeMenu' : 'public.openMenu'));
        button.title = t(open ? 'public.closeMenu' : 'public.openMenu');
    });
}

function initCookiePreferencesControls() {
    const controls = Array.from(document.querySelectorAll('[data-cookie-preferences]'));
    if (!controls.length) return;

    const sync = () => {
        const openPreferences = window.ClashToolsCMP?.openPreferences;
        controls.forEach(control => {
            control.hidden = typeof openPreferences !== 'function';
            control.onclick = typeof openPreferences === 'function'
                ? () => openPreferences.call(window.ClashToolsCMP)
                : null;
        });
    };
    sync();
    window.addEventListener('clashtools:cmp-ready', sync);
}

function initHomepageReveal() {
    const items = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;
    document.documentElement.classList.add('has-reveal');

    const heroItems = items.filter(item => item.closest('.home3-hero'));
    const scrollItems = items.filter(item => !heroItems.includes(item));
    window.requestAnimationFrame(() => {
        heroItems.forEach(item => item.classList.add('is-visible'));
    });

    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        scrollItems.forEach(item => item.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });

    scrollItems.forEach(item => observer.observe(item));
}

function initHomepageSpotlight() {
    const hero = document.querySelector('[data-home-spotlight]');
    if (!hero || window.matchMedia('(pointer: coarse)').matches) return;

    hero.addEventListener('pointermove', event => {
        const rect = hero.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        hero.style.setProperty('--mx', `${Math.max(0, Math.min(100, x))}%`);
        hero.style.setProperty('--my', `${Math.max(0, Math.min(100, y))}%`);
    }, { passive: true });
}

function initHomepageDemo() {
    const demo = document.querySelector('[data-home-demo]');
    if (!demo) return;

    const tabs = Array.from(demo.querySelectorAll('[data-demo-tab]'));
    const panels = Array.from(demo.querySelectorAll('[data-demo-panel]'));
    if (!tabs.length || !panels.length) return;

    let activeIndex = Math.max(0, tabs.findIndex(tab => tab.classList.contains('is-active')));
    let timer = null;
    let paused = false;

    const activate = index => {
        const safeIndex = ((index % tabs.length) + tabs.length) % tabs.length;
        activeIndex = safeIndex;
        tabs.forEach((tab, tabIndex) => {
            const active = tabIndex === safeIndex;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
        });
        panels.forEach((panel, panelIndex) => {
            const active = panelIndex === safeIndex;
            panel.hidden = !active;
            panel.classList.toggle('is-active', active);
        });
    };

    const restart = () => {
        if (timer) window.clearInterval(timer);
        if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        timer = window.setInterval(() => activate(activeIndex + 1), 6500);
    };

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => {
            activate(index);
            restart();
        });
        tab.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0
                : event.key === 'End' ? tabs.length - 1
                    : index + (event.key === 'ArrowRight' ? 1 : -1);
            activate(next);
            tabs[activeIndex]?.focus();
            restart();
        });
    });

    const setPaused = value => {
        paused = value;
        restart();
    };
    demo.addEventListener('pointerenter', () => setPaused(true));
    demo.addEventListener('pointerleave', () => setPaused(false));
    demo.addEventListener('focusin', () => setPaused(true));
    demo.addEventListener('focusout', event => {
        if (!demo.contains(event.relatedTarget)) setPaused(false);
    });

    activate(activeIndex);
    restart();
}

function initProductFlow() {
    document.querySelectorAll('[data-product-flow]').forEach(root => {
        const tabs = Array.from(root.querySelectorAll('[data-flow-tab]'));
        const panels = Array.from(root.querySelectorAll('[data-flow-panel]'));
        if (!tabs.length || !panels.length) return;

        const activate = key => {
            tabs.forEach(tab => {
                const active = tab.dataset.flowTab === key;
                tab.classList.toggle('is-active', active);
                tab.setAttribute('aria-selected', String(active));
                tab.tabIndex = active ? 0 : -1;
            });
            panels.forEach(panel => {
                const active = panel.dataset.flowPanel === key;
                panel.hidden = !active;
                panel.classList.toggle('is-active', active);
            });
        };

        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activate(tab.dataset.flowTab));
            tab.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const nextIndex = event.key === 'Home' ? 0
                    : event.key === 'End' ? tabs.length - 1
                        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                const next = tabs[nextIndex];
                activate(next.dataset.flowTab);
                next.focus();
            });
        });
    });
}

function initPublicAuthNavigation() {
    if (!document.body?.classList.contains('public-site')) return;
    onAuthStateChange((_session, state) => updatePublicHeaderAuth(state));
}

function init() {
    normalizePublicShell();
    initPublicAuthNavigation();
    initI18n();
    initPublicPageBindings();
    initPublicResourcePages();
    initThemeButtons();
    initPublicMenu();
    initCookiePreferencesControls();
    initHomepageReveal();
    initHomepageSpotlight();
    initHomepageDemo();
    initProductFlow();
    window.addEventListener('clashtools:language-changed', updateThemeButtons);
}

init();
