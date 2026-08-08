const ADVANCED_STATS_PATH = '/app/advanced-stats';

function icon() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 18.5V14m4.7 4.5V9.5m4.6 9V12m4.7 6.5V5.5" stroke-width="1.7" stroke-linecap="round"/>
        <path d="m5 10 4.7-3 4.6 2.1L19 4.5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function ensureNavigation() {
    if (!document.body?.classList.contains('workspace-app')) return false;
    const navigation = document.querySelector('#workspace-navigation');
    if (!navigation) return false;

    const dashboard = navigation.querySelector('[data-workspace-nav="dashboard"]');
    if (!dashboard) return false;

    let heading = navigation.querySelector('[data-advanced-stats-nav-section]');
    if (!heading) {
        heading = document.createElement('p');
        heading.dataset.advancedStatsNavSection = 'true';
        heading.textContent = 'Stats';
        dashboard.insertAdjacentElement('afterend', heading);
    }

    let link = navigation.querySelector('[data-workspace-nav="advancedStats"]');
    if (!link) {
        link = document.createElement('a');
        link.href = ADVANCED_STATS_PATH;
        link.dataset.workspaceNav = 'advancedStats';
        link.innerHTML = `${icon()}<span data-i18n="nav.advancedStats">Advanced Stats</span>`;
        heading.insertAdjacentElement('afterend', link);
    }

    const currentPath = window.location.pathname.replace(/\/+$/, '');
    const active = currentPath === ADVANCED_STATS_PATH;
    if (active) {
        navigation.querySelectorAll('[data-workspace-nav][aria-current="page"]').forEach(item => {
            if (item !== link) item.removeAttribute('aria-current');
        });
        link.setAttribute('aria-current', 'page');
        const breadcrumb = document.querySelector('[data-workspace-current]');
        if (breadcrumb) {
            breadcrumb.dataset.i18n = 'nav.advancedStats';
            breadcrumb.textContent = 'Advanced Stats';
        }
    } else {
        link.removeAttribute('aria-current');
    }

    if (link.dataset.advancedStatsPrefetchBound !== 'true') {
        link.dataset.advancedStatsPrefetchBound = 'true';
        const prefetch = () => fetch(ADVANCED_STATS_PATH, {
            credentials: 'same-origin',
            cache: 'force-cache'
        }).catch(() => null);
        link.addEventListener('pointerenter', prefetch, { once: true, passive: true });
        link.addEventListener('focus', prefetch, { once: true });
    }

    return true;
}

function install() {
    if (!document.body?.classList.contains('workspace-app')) return;
    if (ensureNavigation()) return;
    const observer = new MutationObserver(() => {
        if (!ensureNavigation()) return;
        observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10_000);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
    window.addEventListener('clashtools:page-ready', ensureNavigation);
    window.addEventListener('clashtools:language-changed', ensureNavigation);
}

export { ensureNavigation as ensureAdvancedStatsNavigation };
