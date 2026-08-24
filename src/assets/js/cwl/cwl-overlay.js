import { getClanInfoRequest } from "../API/API-Clan.js";
import { createClanCard } from "../templates/CWLTemplates.js";
import { initAddPlayersOverlay as initPlayerPicker, resetPlayerOverlayState } from "./cwl-overlay-player-picker.js";
import { initOverlayDismissal } from "./cwl-overlay-interactions.js";
import { t } from "../i18n/i18n.js";
import { allowsThirtyPlayerCwl } from "./cwl-league-rules.js";
import { isRedesignFixtureRequested } from "../fixtures/redesign-fixture-mode.js";

export function initOverlayHide() {
    initOverlayDismissal(resetCwlOverlayState);
}

export function initAddPlayersOverlay(refs) {
    initPlayerPicker(refs, resetCwlOverlayState);
}

export function resetCwlOverlayState() {
    resetPlayerOverlayState();
    document.querySelector('#cwl-input-clan-clancode') && (document.querySelector('#cwl-input-clan-clancode').value = '');
    document.querySelectorAll('#cwl-group-preview-list .cwl-player-article.selected')
        .forEach(card => card.classList.remove('selected'));
    const groupSelect = document.querySelector('#cwl-select-group');
    if (groupSelect) groupSelect.value = '';
    document.querySelector('#cwl-select-group-poll')?.replaceChildren(option('', t('cwl.noPollSelected')));
    document.querySelector('#cwl-group-linked-clans')?.replaceChildren();
    document.querySelector('#cwl-group-linked-clans')?.classList.add('hidden');
    document.querySelector('#cwl-group-preview-list')?.replaceChildren();
    const groupPreview = document.querySelector('#cwl-group-preview');
    if (groupPreview) {
        groupPreview.textContent = t('cwl.previewGroup');
        groupPreview.classList.remove('hidden');
    }
}

function option(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
}

export function initAddClanButton(refs) {
    const { addClanBtn, overlayAddClanBtn, cwlInputClanCode, selectAmountPlayers } = refs;

    addClanBtn.addEventListener("click", () => openAddClanOverlay(selectAmountPlayers, cwlInputClanCode));
    overlayAddClanBtn.addEventListener("click", () => submitAddClan({
        button: overlayAddClanBtn,
        input: cwlInputClanCode,
        select: selectAmountPlayers
    }));
}

function openAddClanOverlay(selectAmountPlayers, input) {
    document.querySelector("#cwl-overlay-add-clan").classList.remove("hidden");
    setClanMessage('');
    ensureCwlSizeOptions(selectAmountPlayers);
    input?.focus();
}

function submitAddClan({ button, input, select }) {
    if (isRedesignFixtureRequested()) return;
    const clanId = input.value.trim();
    if (clanId === "") {
        setClanMessage(t('cwl.tagLabel'), 'error');
        input?.focus();
        return;
    }
    setButtonBusy(button, true);
    getClanInfoRequest(clanId)
        .then(data => addClanFromResponse(data, input, select))
        .catch(error => {
            console.error(error);
            setClanMessage(t('cwl.playerAddError'), 'error');
        })
        .finally(() => setButtonBusy(button, false));
}

function addClanFromResponse(data, input, select) {
    const leagueName = data?.warLeague?.name || "";
    const allowThirty = allowsThirtyPlayerCwl(leagueName);
    applyCwlSizeRestriction(select, allowThirty, leagueName);
    createClanCard(data, allowThirty ? select.value : "15");
    document.querySelector("#cwl-overlay-add-clan")?.classList.add("hidden");
    input.value = "";
    applyCwlSizeRestriction(select, true);
}

function setClanMessage(message, state = '') {
    const node = document.querySelector('#cwl-add-clan-status');
    if (!node) return;
    node.textContent = message;
    node.dataset.state = state;
}

function setButtonBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.dataset.loading = busy ? 'true' : 'false';
}

export function ensureCwlSizeOptions(selectAmountPlayers) {
    if (!selectAmountPlayers.querySelector('option[value="15"]')) {
        const option = document.createElement("option");
        option.value = "15";
        option.textContent = "15v15";
        selectAmountPlayers.appendChild(option);
    }
    if (!selectAmountPlayers.querySelector('option[value="30"]')) {
        const option = document.createElement("option");
        option.value = "30";
        option.textContent = "30v30";
        selectAmountPlayers.appendChild(option);
    }
}

export function applyCwlSizeRestriction(selectAmountPlayers, allowThirty, leagueName = '') {
    ensureCwlSizeOptions(selectAmountPlayers);
    const thirtyOption = selectAmountPlayers.querySelector('option[value="30"]');
    if (!thirtyOption) return;

    thirtyOption.disabled = !allowThirty;
    thirtyOption.textContent = allowThirty ? '30v30' : t('cwl.thirtyUnavailableOption');
    selectAmountPlayers.title = allowThirty
        ? ''
        : t('cwl.thirtyUnavailableForLeague', { league: leagueName || t('cwl.thisLeague') });

    if (!allowThirty && selectAmountPlayers.value === '30') {
        selectAmountPlayers.value = '15';
    }
}
