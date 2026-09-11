import { t } from '../i18n/i18n.js';
import {
    captureCardSettingsDraft,
    createCardSettingsDialog,
    dispatchCardSettingsFocus,
    renderCardSettingsDialog
} from './cwl-card-settings-dialog.js';
const states = new WeakMap();

export function attachPlayerCardSettings(card) {
    return attachCardSettings(card, 'player');
}

export function attachClanCardSettings(card) {
    return attachCardSettings(card, 'clan');
}

function attachCardSettings(card, kind) {
    if (!card || card.dataset.cwlCardSettings) return card;
    const state = ensureState(card.ownerDocument);
    card.dataset.cwlCardSettings = kind;
    hideSourceControls(card, kind);
    const host = kind === 'clan'
        ? card.querySelector('.cwl-clan-info-card') || card
        : card;
    const trigger = createSettingsTrigger(card, kind, host);
    refreshCardReadouts(card, kind);
    card.addEventListener('change', () => refreshCardReadouts(card, kind));
    observeCard(card, kind);
    return trigger;
}

function ensureState(document) {
    const existing = states.get(document);
    if (existing) return existing;
    const state = { document, dialog: null, card: null, trigger: null, kind: '' };
    state.refreshCards = () => refreshAllReadouts(document);
    state.dialog = createCardSettingsDialog(document, {
        close: () => closeDialog(state, true),
        delete: () => deleteCard(state),
        save: () => saveDialog(state),
        languageChanged: () => refreshDialogAndCards(state)
    });
    document.defaultView?.addEventListener('clashtools:cwl-plan-loaded', () => {
        if (state.card) closeDialog(state, false);
    });
    states.set(document, state);
    return state;
}

function createSettingsTrigger(card, kind, host) {
    const document = card.ownerDocument;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cwl-card-settings-button';
    trigger.textContent = '⋯';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'cwl-card-settings-dialog');
    trigger.setAttribute('aria-expanded', 'false');
    updateTriggerLabel(trigger);
    trigger.addEventListener('pointerdown', stopCardDrag);
    trigger.addEventListener('mousedown', stopCardDrag);
    trigger.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openDialog(card, kind, trigger);
    });
    host.appendChild(trigger);
    return trigger;
}

function stopCardDrag(event) {
    event.stopPropagation();
}

function openDialog(card, kind, trigger) {
    const state = ensureState(card.ownerDocument);
    if (state.dialog.open) closeDialog(state, false);
    state.card = card;
    state.trigger = trigger;
    state.kind = kind;
    trigger.setAttribute('aria-expanded', 'true');
    renderCardSettingsDialog(
        state.dialog, card, kind, {},
        dispatchCardSettingsFocus
    );
    if (typeof state.dialog.showModal === 'function') state.dialog.showModal();
    else state.dialog.setAttribute('open', '');
    focusFirstField(state.dialog);
}

function closeDialog(state, restoreFocus) {
    if (state.dialog.open && typeof state.dialog.close === 'function') state.dialog.close();
    else state.dialog.removeAttribute('open');
    state.trigger?.setAttribute('aria-expanded', 'false');
    const trigger = state.trigger;
    state.card = null;
    state.trigger = null;
    state.kind = '';
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
}

function saveDialog(state) {
    const values = captureCardSettingsDraft(state.dialog);
    const card = state.card;
    if (!card) return;
    const sources = state.kind === 'clan'
        ? getClanSources(card)
        : getPlayerSources(card);
    sources.forEach(source => {
        const value = values[source.key];
        if (value === undefined || !source.element) return;
        syncSource(source.element, value);
    });
    refreshCardReadouts(card, state.kind);
    closeDialog(state, true);
}

function getPlayerSources(card) {
    return [
        sourceEntry('cwl-player-priority', card.querySelector('.cwl-player-priority')),
        sourceEntry('cwl-roster-status', card.querySelector('.cwl-roster-status')),
        sourceEntry('cwl-move-player', card.querySelector('.cwl-move-player'))
    ].filter(entry => entry.element);
}

function getClanSources(card) {
    return [
        sourceEntry('cwl-clan-priority', card.querySelector('.cwl-clan-priority select')),
        sourceEntry('cwl-clan-capacity', card.querySelector('.cwl-clan-capacity'))
    ].filter(entry => entry.element);
}

function sourceEntry(key, element) {
    return { key, element };
}

function syncSource(source, value) {
    if (source.value === value) return;
    source.value = value;
    const EventConstructor = source.ownerDocument.defaultView?.Event || Event;
    source.dispatchEvent(new EventConstructor('change', { bubbles: true }));
}

function getDeleteSource(card, kind) {
    return card?.querySelector(kind === 'clan' ? '.cwl-delete-clan' : '.cwl-delete-player');
}

function deleteCard(state) {
    const source = getDeleteSource(state.card, state.kind);
    closeDialog(state, false);
    source?.click();
}

function refreshDialogAndCards(state) {
    state.refreshCards();
    if (state.card?.isConnected) {
        renderCardSettingsDialog(
            state.dialog, state.card, state.kind,
            captureCardSettingsDraft(state.dialog), dispatchCardSettingsFocus
        );
    }
}

function refreshAllReadouts(document) {
    document.querySelectorAll('[data-cwl-card-settings="player"]').forEach(card => {
        hideSourceControls(card, 'player');
        refreshCardReadouts(card, 'player');
        updateTriggerLabels(card);
    });
    document.querySelectorAll('[data-cwl-card-settings="clan"]').forEach(card => {
        hideSourceControls(card, 'clan');
        refreshCardReadouts(card, 'clan');
        updateTriggerLabels(card);
    });
}

function observeCard(card, kind) {
    const Observer = card.ownerDocument.defaultView?.MutationObserver;
    if (!Observer) return;
    const observer = new Observer(records => {
        if (records.every(record => record.target.closest?.('.cwl-card-readout'))) return;
        hideSourceControls(card, kind);
        refreshCardReadouts(card, kind);
    });
    observer.observe(card, { childList: true, subtree: true });
}

function refreshCardReadouts(card, kind) {
    const readout = ensureCardReadout(card);
    if (kind === 'clan') {
        refreshReadoutItem(readout, 'cwl-card-readout-priority', t('planner.clanPriority'),
            priorityLabel(card.querySelector('.cwl-clan-priority select'), 'clan'));
        refreshReadoutItem(readout, 'cwl-card-readout-format', t('planner.format'),
            optionLabel(card.querySelector('.cwl-clan-capacity')));
        return;
    }
    refreshReadoutItem(readout, 'cwl-card-readout-priority', t('planner.playerPriority'),
        priorityLabel(card.querySelector('.cwl-player-priority'), 'player'));
    const role = card.querySelector('.cwl-roster-status');
    refreshReadoutItem(readout, 'cwl-card-readout-role', t('cwl.rosterStatus'),
        role ? roleLabel(role.value) : '');
}

function ensureCardReadout(card) {
    const host = card.querySelector('.cwl-clan-info-card') || card;
    let readout = host.querySelector(':scope > .cwl-card-readout');
    if (readout) return readout;
    readout = card.ownerDocument.createElement('span');
    readout.className = 'cwl-card-readout';
    const trigger = host.querySelector('.cwl-card-settings-button');
    host.insertBefore(readout, trigger || null);
    return readout;
}

function refreshReadoutItem(readout, className, label, value) {
    let item = readout.querySelector(`.${className}`);
    if (!value) {
        item?.remove();
        return;
    }
    if (!item) {
        item = readout.ownerDocument.createElement('span');
        item.className = `cwl-card-readout-item ${className}`;
        item.append(
            readout.ownerDocument.createElement('span'),
            readout.ownerDocument.createElement('span')
        );
        item.firstElementChild.className = 'cwl-card-readout-label';
        item.lastElementChild.className = 'cwl-card-readout-value';
        readout.appendChild(item);
    }
    const description = `${label}: ${value}`;
    item.title = description;
    item.setAttribute('aria-label', description);
    item.setAttribute('role', 'group');
    item.querySelector('.cwl-card-readout-label').textContent = `${label}:`;
    item.querySelector('.cwl-card-readout-value').textContent = value;
}

function priorityLabel(select, kind) {
    const value = select?.value || (kind === 'clan' ? 'auto' : 'normal');
    if (kind === 'clan') return t(`planner.clanPriority${capitalize(value)}`);
    return t(`planner.playerPriority${capitalize(value)}`);
}

function roleLabel(value) {
    const key = { core: 'cwl.rosterCore', rotation: 'cwl.rosterRotation', reserve: 'cwl.rosterReserve' }[value];
    return key ? t(key) : '';
}

function optionLabel(select) {
    return select?.selectedOptions?.[0]?.textContent?.trim() || select?.value || '';
}

function hideSourceControls(card, kind) {
    const selectors = kind === 'clan'
        ? '.cwl-clan-priority, .cwl-clan-format, .cwl-delete-clan'
        : '.cwl-player-control-group, .cwl-delete-player';
    card.querySelectorAll(selectors).forEach(control => {
        control.hidden = true;
        control.setAttribute('aria-hidden', 'true');
    });
}

function updateTriggerLabels(card) {
    const trigger = card.querySelector('.cwl-card-settings-button');
    if (trigger) updateTriggerLabel(trigger);
}

function updateTriggerLabel(trigger) {
    const label = t('planner.settings');
    trigger.title = label;
    trigger.setAttribute('aria-label', label);
}

function focusFirstField(dialog) {
    const field = dialog.querySelector('.cwl-card-settings-control, [data-settings-close]');
    field?.focus({ preventScroll: true });
}

function capitalize(value) {
    const normalized = String(value || '');
    return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : '';
}
