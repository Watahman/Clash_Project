import { t } from '../i18n/i18n.js?v=20260831-master-live-v1';
import { getWorkspaceModule } from './module-registry.js?v=20260829-public-dashboard-v1';
import { isPreviewProgressModule, isPreviewProgressUnlocked } from './preview-progress-access.js?v=20260916-preview-progress-v1';

export function removePreviewComingSoonBadge() {
    document.querySelectorAll('[data-preview-progress-coming-soon]').forEach(element => element.remove());
    document.title = document.title.replace(/\s*\(Coming soon\)/i, '');
}

function ensureProfileComingSoonBadge(element) {
    if (element.querySelector('.workspace-coming-soon-badge')) return;
    const heading = element.querySelector('strong');
    if (!heading) return;
    const badge = document.createElement('small');
    badge.className = 'workspace-coming-soon-badge';
    badge.dataset.i18n = 'common.comingSoon';
    badge.textContent = '(Coming soon)';
    heading.append(' ', badge);
}

function setProfileLinkState(element, module, unlocked) {
    const action = element.querySelector('[data-preview-progress-action]');
    element.classList.toggle('profile-next-link--coming-soon', !unlocked);
    if (unlocked) {
        element.removeAttribute('aria-disabled');
        element.removeAttribute('tabindex');
        element.href = module.href;
        element.querySelector('.workspace-coming-soon-badge')?.remove();
    } else {
        element.setAttribute('aria-disabled', 'true');
        element.setAttribute('tabindex', '-1');
        element.removeAttribute('href');
        ensureProfileComingSoonBadge(element);
    }
    if (action) {
        const key = unlocked ? 'explore.open' : 'common.comingSoon';
        action.dataset.i18n = key;
        action.textContent = t(key);
    }
}

function applyProfileLinks(enabled) {
    document.querySelectorAll('[data-preview-progress-module]').forEach(element => {
        const module = getWorkspaceModule(element.dataset.previewProgressModule);
        if (isPreviewProgressModule(module)) {
            setProfileLinkState(element, module, isPreviewProgressUnlocked(module, enabled));
        }
    });
}

function setNavigationLinkState(element, module, unlocked) {
    const copy = element.querySelector('.workspace-nav-item-copy');
    const badge = copy?.querySelector('.workspace-coming-soon-badge');
    element.classList.toggle('workspace-nav-coming-soon', !unlocked);
    if (unlocked) {
        element.removeAttribute('aria-disabled');
        element.removeAttribute('tabindex');
        element.href = module.href;
        badge?.remove();
        return;
    }
    element.setAttribute('aria-disabled', 'true');
    element.setAttribute('tabindex', '-1');
    element.removeAttribute('href');
    if (copy && !badge) {
        const comingSoon = document.createElement('small');
        comingSoon.className = 'workspace-coming-soon-badge';
        comingSoon.dataset.i18n = 'common.comingSoon';
        comingSoon.textContent = '(Coming soon)';
        copy.append(comingSoon);
    }
}

export function applyPreviewNavigation(state) {
    const enabled = state?.enabled === true;
    applyProfileLinks(enabled);
    document.querySelectorAll('[data-workspace-nav]').forEach(element => {
        const module = getWorkspaceModule(element.dataset.workspaceNav);
        if (isPreviewProgressModule(module)) {
            setNavigationLinkState(element, module, isPreviewProgressUnlocked(module, enabled));
        }
    });
    if (enabled) removePreviewComingSoonBadge();
}
