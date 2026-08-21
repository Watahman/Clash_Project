import { t } from '../../i18n/i18n.js';
import { getCurrentPlanSnapshot } from '../cwl-plan-io.js';
import {
    downloadCwlExportPng,
    fitCwlExportPreview,
    renderCwlExportTemplate
} from './cwl-export-renderer.js?v=20260821-badge-v2';
import { downloadCwlExportWorkbook } from './cwl-export-xlsx.js';

const DEFAULT_OPTIONS = Object.freeze({
    scope: 'complete',
    showNames: true,
    showTownHall: true,
    showTags: false,
    showRoles: true
});

let activeController;

export function initCwlPlanExport({ root = document } = {}) {
    const refs = collectRefs(root);
    if (!refs.open || !refs.dialog || activeController) return activeController;

    const state = {
        refs,
        snapshot: null,
        template: null,
        opener: null,
        options: { ...DEFAULT_OPTIONS },
        open: false,
        restored: false
    };
    bindEvents(state);
    activeController = Object.freeze({
        open: () => openExport(state),
        close: () => closeExport(state)
    });
    return activeController;
}

function collectRefs(root) {
    const query = selector => root?.querySelector?.(selector);
    return {
        open: query('#cwl-export-plan-button'),
        dialog: query('#cwl-export-dialog'),
        close: query('#cwl-export-close'),
        cancel: query('#cwl-export-cancel'),
        png: query('#cwl-export-download-png'),
        workbook: query('#cwl-export-download-excel'),
        status: query('#cwl-export-status'),
        frame: query('#cwl-export-preview-frame'),
        clanControl: query('#cwl-export-clan-control'),
        clanSelect: query('#cwl-export-clan-select'),
        scopes: [...(root?.querySelectorAll?.('input[name="cwl-export-scope"]') || [])],
        toggles: [...(root?.querySelectorAll?.('[data-cwl-export-toggle]') || [])]
    };
}

function bindEvents(state) {
    const { refs } = state;
    refs.open.addEventListener('click', () => void openExport(state));
    refs.close?.addEventListener('click', () => closeExport(state));
    refs.cancel?.addEventListener('click', () => closeExport(state));
    refs.dialog.addEventListener('cancel', event => {
        event.preventDefault();
        closeExport(state);
    });
    refs.dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeExport(state);
            return;
        }
        if (event.key === 'Tab') trapFocus(refs.dialog, event);
    });
    refs.dialog.addEventListener('click', event => {
        if (event.target === refs.dialog) closeExport(state);
    });
    refs.dialog.addEventListener('close', () => restoreFocus(state));
    refs.scopes.forEach(input => input.addEventListener('change', () => refresh(state)));
    refs.toggles.forEach(input => input.addEventListener('change', () => refresh(state)));
    refs.clanSelect?.addEventListener('change', () => refresh(state));
    refs.png?.addEventListener('click', () => void download(state, downloadCwlExportPng));
    refs.workbook?.addEventListener('click', () => void download(state, downloadCwlExportWorkbook));
    window.addEventListener('clashtools:language-changed', () => {
        if (!state.open) return;
        updateClanOptions(state);
        void renderPreview(state);
    });
    window.addEventListener('clashtools:cwl-planner-tool-open', event => {
        if (state.open && event.detail?.tool !== 'export') closeExport(state);
    });
    window.addEventListener('resize', () => syncPreviewSize(state), { passive: true });
}

function syncPreviewSize(state) {
    if (!state.open || !state.template) return;
    fitCwlExportPreview(state.refs.frame, state.template);
}

async function openExport(state) {
    if (state.open) return;
    state.opener = state.refs.open.closest('details')?.querySelector('summary')
        || document.activeElement;
    state.restored = false;
    state.options = { ...DEFAULT_OPTIONS };
    state.snapshot = null;
    state.template = null;
    state.open = true;
    state.refs.open.setAttribute('aria-expanded', 'true');
    window.dispatchEvent(new CustomEvent('clashtools:cwl-planner-tool-open', {
        detail: { tool: 'export' }
    }));
    showDialog(state);
    setBusy(state, true);
    setStatus(state, t('cwl.exportLoading'), 'loading');
    try {
        state.snapshot = await Promise.resolve(getCurrentPlanSnapshot());
        updateClanOptions(state);
        await renderPreview(state);
    } catch (error) {
        state.snapshot = null;
        clearPreview(state);
        setStatus(state, error?.message || t('cwl.exportError'), 'error');
    } finally {
        setBusy(state, false);
    }
}

function showDialog(state) {
    const { dialog, close } = state.refs;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    close?.focus({ preventScroll: true });
}

async function renderPreview(state) {
    if (!state.open || !state.snapshot) return;
    const options = readOptions(state);
    state.options = options;
    if (isEmptySnapshot(state.snapshot)) {
        clearPreview(state);
        setStatus(state, t('cwl.exportEmpty'), 'empty');
        setBusy(state, false);
        return;
    }
    if (options.scope === 'clan' && !options.clanId) {
        clearPreview(state);
        setStatus(state, t('cwl.exportNoClans'), 'empty');
        setBusy(state, false);
        return;
    }
    setStatus(state, t('cwl.exportLoading'), 'loading');
    try {
        const template = renderCwlExportTemplate(state.refs.frame, state.snapshot, options);
        paintPreview(state.refs.frame, template);
        state.template = template;
        syncPreviewSize(state);
        setStatus(state, t('cwl.exportReady'), 'ready');
    } catch (error) {
        clearPreview(state);
        setStatus(state, error?.message || t('cwl.exportError'), 'error');
    }
}

function readOptions(state) {
    const scope = state.refs.scopes.find(input => input.checked)?.value || 'complete';
    const clanId = state.refs.clanSelect?.value || '';
    const clanTag = state.refs.clanSelect?.selectedOptions?.[0]?.dataset.clanTag || '';
    const value = name => state.refs.toggles.find(input => input.dataset.cwlExportToggle === name)?.checked;
    return {
        scope,
        clanId,
        clanTag,
        showNames: value('names') ?? DEFAULT_OPTIONS.showNames,
        showTownHall: value('town-hall') ?? DEFAULT_OPTIONS.showTownHall,
        showTags: value('tags') ?? DEFAULT_OPTIONS.showTags,
        showRoles: value('roles') ?? DEFAULT_OPTIONS.showRoles
    };
}

function updateClanOptions(state) {
    const { clanControl, clanSelect } = state.refs;
    if (!clanSelect) return;
    const clans = Array.isArray(state.snapshot?.clans) ? state.snapshot.clans : [];
    const selected = clanSelect.value;
    clanSelect.replaceChildren(...clans.map(clan => {
        const option = document.createElement('option');
        option.value = clan.id || clan.tag || '';
        option.dataset.clanTag = clan.tag || '';
        option.textContent = clan.name || clan.tag || t('cwl.exportClan');
        return option;
    }));
    if (selected && clans.some(clan => (clan.id || clan.tag) === selected)) clanSelect.value = selected;
    if (!clanSelect.value && clans[0]) clanSelect.value = clans[0].id || clans[0].tag || '';
    const single = state.refs.scopes.find(input => input.checked)?.value === 'clan';
    if (clanControl) {
        clanControl.hidden = !single;
        clanControl.setAttribute('aria-hidden', String(!single));
    }
    clanSelect.disabled = !single || clans.length === 0;
}

function refresh(state) {
    if (!state.open) return;
    updateClanOptions(state);
    void renderPreview(state);
}

async function download(state, exporter) {
    if (!state.open || !state.snapshot) return;
    const options = readOptions(state);
    state.options = options;
    setBusy(state, true);
    setStatus(state, t('cwl.exportLoading'), 'loading');
    try {
        const payload = exporter === downloadCwlExportPng ? state.template : state.snapshot;
        await exporter(payload, options);
        setStatus(state, t('cwl.exportReady'), 'ready');
    } catch (error) {
        setStatus(state, error?.message || t('cwl.exportDownloadError'), 'error');
    } finally {
        setBusy(state, false);
    }
}

function setBusy(state, busy) {
    const { dialog, png, workbook } = state.refs;
    dialog?.setAttribute('aria-busy', String(busy));
    if (png) png.disabled = busy || !state.template;
    if (workbook) workbook.disabled = busy || !state.snapshot || isEmptySnapshot(state.snapshot);
}

function setStatus(state, message, status) {
    if (!state.refs.status) return;
    state.refs.status.textContent = message;
    state.refs.status.dataset.state = status;
}

function paintPreview(frame, template) {
    if (!frame) return;
    if (typeof Node !== 'undefined' && template instanceof Node) frame.replaceChildren(template);
    else if (typeof DocumentFragment !== 'undefined' && template instanceof DocumentFragment) frame.replaceChildren(template);
    else frame.innerHTML = String(template || '');
}

function clearPreview(state) {
    state.template = null;
    state.refs.frame?.replaceChildren();
}

function isEmptySnapshot(snapshot) {
    return !snapshot || (!snapshot.clans?.length && !snapshot.freePlayers?.length);
}

function closeExport(state) {
    if (!state.open) return;
    state.open = false;
    state.refs.open.setAttribute('aria-expanded', 'false');
    state.snapshot = null;
    clearPreview(state);
    if (typeof state.refs.dialog.close === 'function' && state.refs.dialog.open) state.refs.dialog.close();
    else state.refs.dialog.removeAttribute('open');
    restoreFocus(state);
}

function restoreFocus(state) {
    if (state.restored) return;
    state.restored = true;
    if (state.opener?.isConnected) state.opener.focus({ preventScroll: true });
    state.opener = null;
}

function trapFocus(dialog, event) {
    const focusable = [...dialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )];
    if (focusable.length < 2) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
