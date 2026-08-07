const ACHIEVEMENTS_PATH = '/app/achievements';
const ACHIEVEMENT_LABELS = Object.freeze({
    nl: 'Achievements',
    en: 'Achievements',
    fr: 'Succès',
    de: 'Erfolge',
    es: 'Logros'
});

function currentLabel() {
    if (typeof document === 'undefined') return ACHIEVEMENT_LABELS.en;
    let language = 'en';
    try {
        language = localStorage.getItem('clashtools_language') || document.documentElement.lang || 'en';
    } catch {
        language = document.documentElement.lang || 'en';
    }
    return ACHIEVEMENT_LABELS[language] || ACHIEVEMENT_LABELS.en;
}

function achievementIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13v4m-3 3h6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function ensureAchievementsNavigation() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    const navigation = document.querySelector('#workspace-navigation');
    if (!navigation) return false;

    let link = navigation.querySelector('[data-workspace-nav="achievements"]');
    if (!link) {
        link = document.createElement('a');
        link.href = ACHIEVEMENTS_PATH;
        link.dataset.workspaceNav = 'achievements';
        link.innerHTML = `${achievementIcon()}<span data-i18n="nav.achievements">Achievements</span>`;
        const dashboard = navigation.querySelector('[data-workspace-nav="dashboard"]');
        dashboard?.insertAdjacentElement('afterend', link);
    }

    const label = currentLabel();
    const labelElement = link.querySelector('span');
    if (labelElement) labelElement.textContent = label;

    const active = window.location.pathname.replace(/\/+$/, '') === ACHIEVEMENTS_PATH;
    if (active) {
        link.setAttribute('aria-current', 'page');
        const breadcrumb = document.querySelector('[data-workspace-current]');
        if (breadcrumb) {
            breadcrumb.dataset.i18n = 'nav.achievements';
            breadcrumb.textContent = label;
        }
    } else {
        link.removeAttribute('aria-current');
    }

    if (link.dataset.achievementPrefetchBound !== 'true') {
        link.dataset.achievementPrefetchBound = 'true';
        link.addEventListener('pointerenter', prefetchAchievements, { once: true, passive: true });
        link.addEventListener('focus', prefetchAchievements, { once: true });
    }
    return true;
}

function prefetchAchievements() {
    fetch(ACHIEVEMENTS_PATH, {
        credentials: 'same-origin',
        cache: 'force-cache'
    }).catch(() => null);
}

function install() {
    if (ensureAchievementsNavigation()) return;
    const observer = new MutationObserver(() => {
        if (typeof document === 'undefined' || typeof window === 'undefined') {
            observer.disconnect();
            return;
        }
        if (!ensureAchievementsNavigation()) return;
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
    window.addEventListener('clashtools:page-ready', ensureAchievementsNavigation);
    window.addEventListener('clashtools:language-changed', ensureAchievementsNavigation);
}