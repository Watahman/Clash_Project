import { t } from '../i18n/i18n.js';

const ROLE_LABELS = Object.freeze({
    core: 'cwl.rosterCore',
    rotation: 'cwl.rosterRotation',
    reserve: 'cwl.rosterReserve'
});

export function createCardSettingsDialog(document, handlers) {
    const dialog = document.createElement('dialog');
    dialog.id = 'cwl-card-settings-dialog';
    dialog.className = 'cp-modal cwl-card-settings-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'cwl-card-settings-title');
    dialog.innerHTML = `
        <header class="cwl-card-settings-header">
            <div>
                <p class="page-kicker" data-settings-kicker></p>
                <h2 id="cwl-card-settings-title" data-settings-title></h2>
            </div>
            <button class="button button-quiet" type="button" data-settings-close></button>
        </header>
        <form class="cwl-card-settings-form" novalidate>
            <div class="cwl-card-settings-fields" data-settings-fields></div>
            <footer class="cwl-card-settings-actions">
                <button class="button button-danger" type="button" data-settings-delete></button>
                <button class="button button-quiet" type="button" data-settings-cancel></button>
                <button class="button button-primary" type="submit" data-settings-save></button>
            </footer>
        </form>`;
    document.body?.appendChild(dialog);
    bindDialog(dialog, handlers);
    return dialog;
}

function bindDialog(dialog, handlers) {
    const close = () => handlers.close();
    dialog.querySelector('[data-settings-close]')?.addEventListener('click', close);
    dialog.querySelector('[data-settings-cancel]')?.addEventListener('click', close);
    dialog.querySelector('[data-settings-delete]')?.addEventListener('click', handlers.delete);
    dialog.querySelector('form')?.addEventListener('submit', event => {
        event.preventDefault();
        handlers.save();
    });
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        close();
    });
    dialog.addEventListener('click', event => {
        if (event.target === dialog) close();
    });
    dialog.ownerDocument.defaultView?.addEventListener(
        'clashtools:language-changed', handlers.languageChanged
    );
}

export function renderCardSettingsDialog(dialog, card, kind, draft, focusSource) {
    if (!card) return;
    dialog.querySelector('[data-settings-kicker]').textContent = t('planner.settings');
    dialog.querySelector('[data-settings-title]').textContent = cardTitle(card, kind);
    dialog.querySelector('[data-settings-close]').textContent = t('common.close');
    dialog.querySelector('[data-settings-cancel]').textContent = t('drafts.cancel');
    dialog.querySelector('[data-settings-save]').textContent = t('settings.save');
    dialog.querySelector('[data-settings-delete]').textContent = t(
        kind === 'clan' ? 'cwl.deleteClan' : 'cwl.removePlayer'
    );
    const fields = dialog.querySelector('[data-settings-fields]');
    fields.replaceChildren(...buildFields(card, kind, draft, focusSource));
}

function cardTitle(card, kind) {
    const selector = kind === 'clan' ? '.cwl-clan-name' : '.cwl-player-name';
    return card.querySelector(selector)?.textContent?.trim() || t('planner.settings');
}

function buildFields(card, kind, draft, focusSource) {
    return kind === 'clan'
        ? buildClanFields(card, draft)
        : buildPlayerFields(card, draft, focusSource);
}

function buildPlayerFields(card, draft, focusSource) {
    const priority = card.querySelector('.cwl-player-priority');
    const role = card.querySelector('.cwl-roster-status');
    const move = card.querySelector('.cwl-move-player');
    if (move) focusSource(move);
    return [
        priority && createField(
            t('planner.playerPriority'), priority, draft,
            translatePlayerPriorityOptions, 'cwl-player-priority'
        ),
        role && createField(
            t('cwl.rosterStatus'), role, draft, translateRoleOptions, 'cwl-roster-status'
        ),
        move && createField(t('cwl.movePlayer'), move, draft, null, 'cwl-move-player')
    ].filter(Boolean);
}

function buildClanFields(card, draft) {
    const priority = card.querySelector('.cwl-clan-priority select');
    const format = card.querySelector('.cwl-clan-capacity');
    return [
        priority && createField(
            t('planner.clanPriority'), priority, draft,
            translateClanPriorityOptions, 'cwl-clan-priority'
        ),
        format && createField(t('planner.format'), format, draft, null, 'cwl-clan-capacity')
    ].filter(Boolean);
}

function createField(labelText, source, draft, transform = null, key = '') {
    const document = source.ownerDocument;
    const label = document.createElement('label');
    label.className = 'cwl-card-settings-field';
    const text = document.createElement('span');
    text.textContent = labelText;
    const select = document.createElement('select');
    select.className = 'cwl-card-settings-control';
    select.dataset.settingsField = key || source.className || source.parentElement?.className || labelText;
    Array.from(source.options).forEach(option => select.appendChild(option.cloneNode(true)));
    transform?.(select);
    select.value = draft?.[select.dataset.settingsField] ?? source.value;
    select.setAttribute('aria-label', labelText);
    label.append(text, select);
    return label;
}

function translateRoleOptions(select) {
    Array.from(select.options).forEach(option => {
        const key = ROLE_LABELS[option.value];
        if (key) option.textContent = t(key);
    });
}

function translatePlayerPriorityOptions(select) {
    Array.from(select.options).forEach(option => {
        option.textContent = t(`planner.playerPriority${capitalize(option.value)}`);
    });
}

function translateClanPriorityOptions(select) {
    Array.from(select.options).forEach(option => {
        option.textContent = t(`planner.clanPriority${capitalize(option.value)}`);
    });
}

export function dispatchCardSettingsFocus(source) {
    const EventConstructor = source.ownerDocument.defaultView?.Event || Event;
    source.dispatchEvent(new EventConstructor('focus'));
}

export function captureCardSettingsDraft(dialog) {
    if (!dialog) return {};
    return Object.fromEntries(Array.from(dialog.querySelectorAll('[data-settings-field]'))
        .map(select => [select.dataset.settingsField, select.value]));
}

function capitalize(value) {
    const normalized = String(value || '');
    return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : '';
}
