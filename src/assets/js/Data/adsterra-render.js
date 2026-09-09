import { APP_AD_ELIGIBLE_ROUTES } from './adsterra-config.js';

export function isVisibleElement(element) {
    if (!element || element.hidden || element.getAttribute?.('aria-hidden') === 'true') return false;
    const style = globalThis.window?.getComputedStyle?.(element);
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) return false;
    const rect = element.getBoundingClientRect?.();
    return !rect || (rect.width > 1 && rect.height > 1);
}

export function hasSensitiveOverlay(doc = globalThis.document) {
    const candidates = doc?.querySelectorAll?.('dialog[open], [role="dialog"], .overlay, .cp-modal') || [];
    return Array.from(candidates).some(isVisibleElement);
}

export function hasWorkspaceShell(doc) {
    const main = doc?.querySelector?.('main');
    if (!main || main.hidden || main.matches('[data-loading="true"], [data-empty="true"], [data-error="true"]')) return false;
    if (!doc.body?.classList.contains('workspace-app')) return false;
    return true;
}

function hasReadyDraftRows(doc) {
    const status = doc.querySelector('#drafts-status');
    const rows = doc.querySelector('#draft-cwl-container');
    return Boolean(rows?.children.length && !/loading/i.test(status?.textContent || ''));
}

export function isAppContentReady(path, doc = globalThis.document) {
    if (!hasWorkspaceShell(doc) || hasSensitiveOverlay(doc)
        || doc.documentElement?.classList.contains('workspace-page-loading')) return false;
    const required = {
        '/dashboard': '.dashboard-priority-grid',
        '/app/advanced-stats': '#advanced-stats-summary-section',
        '/app/achievements': '#achievement-grid',
        '/app/cwl-planner': '.cwl-page-header',
        '/app/cwl-tracker': '#op-board-tabs',
        '/app/war-board': '#war-board-content',
        '/app/clan-management': '#groups-detail-content',
        '/app/explore': '.explore-grid',
        '/app/brackets': '.bracket-page-header',
        '/app/minigames': '.minigames-hero'
    }[path];
    if (path === '/app/cwl-planner-drafts') return hasReadyDraftRows(doc);
    if (required && !isVisibleElement(doc.querySelector(required))) return false;
    if (path === '/app/achievements' && isVisibleElement(doc.querySelector('#achievement-empty-state'))) return false;
    if (path === '/app/explore' && !doc.querySelector('.explore-grid')?.children.length) return false;
    return true;
}

export function isPlacementReady(path, anchor) {
    if (!isVisibleElement(anchor) || anchor.closest?.('dialog, [role="dialog"], .overlay, .cp-modal')) return false;
    return !APP_AD_ELIGIBLE_ROUTES.has(path) || isAppContentReady(path, anchor.ownerDocument);
}

export function creativeDetectorMarkup(slotId) {
    return `
        const report = status => parent.postMessage({ source: 'clashpanel-adsterra', slot: '${slotId}', status }, '*');
        const visible = node => { const rect = node.getBoundingClientRect?.(); const style = getComputedStyle(node); return rect && rect.width > 16 && rect.height > 16 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'; };
        const creative = () => Array.from(document.body?.children || []).some(node => node.tagName !== 'SCRIPT' && visible(node) && (node.tagName === 'IFRAME' || (node.tagName === 'IMG' && node.complete && node.naturalWidth > 0) || node.tagName === 'VIDEO' || node.tagName === 'OBJECT' || node.textContent.trim().length > 12 || node.querySelector('iframe,video,object,canvas,svg,img[src]')));
        let rendered = false;
        const check = () => { if (!rendered && creative()) { rendered = true; report('rendered'); observer.disconnect(); } };
        window.__clashpanelCheckCreative = check;
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
        window.addEventListener('load', check, { once: true });
        setTimeout(check, 150);
    `;
}

function hasVisibleNativeCreative(container) {
    return Array.from(container.children).some(child => {
        if (child.tagName === 'SCRIPT' || !isVisibleElement(child)) return false;
        return child.matches('iframe,img,video,object,embed,canvas,svg,a')
            || child.textContent.trim().length > 12
            || Boolean(child.querySelector('iframe,img,video,object,embed,canvas,svg,a'));
    });
}

export function waitForNativeCreative(container, script, timeoutMs = 10000) {
    return new Promise(resolve => {
        let settled = false;
        let timer;
        const observer = new MutationObserver(() => finish(hasVisibleNativeCreative(container)));
        const finish = ok => {
            if (settled) return;
            settled = true;
            observer.disconnect();
            if (timer) globalThis.window?.clearTimeout(timer);
            resolve(ok);
        };
        timer = globalThis.window?.setTimeout(() => finish(false), timeoutMs);
        observer.observe(container, { childList: true, subtree: true, attributes: true });
        script.addEventListener('load', () => {
            if (hasVisibleNativeCreative(container)) finish(true);
        }, { once: true });
        script.addEventListener('error', () => finish(false), { once: true });
    });
}

export function observeReadiness(root, onChange) {
    const target = root?.documentElement || root?.body;
    if (!globalThis.MutationObserver || !target) return null;
    let timer;
    const observer = new MutationObserver(() => {
        if (timer) globalThis.window?.clearTimeout(timer);
        timer = globalThis.window?.setTimeout(onChange, 120);
    });
    observer.observe(target, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'hidden', 'aria-hidden', 'aria-busy', 'data-state']
    });
    return observer;
}
