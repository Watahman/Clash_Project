import { getClanMembersBasicData, getPlayerBasicData } from "../API/API-Functions.js";
import { getClanInfoRequest } from "../API/API-Clan.js";
import { createPlayerCard, createClanCard } from "../templates/CWLTemplates.js";
import { getUserBases } from "../Supabase/Supabase-User.js";
import { getFriends } from "../Supabase/Supabase-Friend.js";
import { initGroupOverlay } from "./cwl-group.js";
import { getCurrentUserId } from "../utils/user.js";
import { uniquePlayers } from "./cwl-utils.js";
import { t } from "../i18n/i18n.js";
import { allowsThirtyPlayerCwl } from "./cwl-league-rules.js";
import { bindBackdropClick } from "../utils/backdrop-click.js";

let accountLoadToken = 0;
let activeAccountSource = 'user';
let refsCache = {};

export function initOverlayHide() {
    document.querySelectorAll(".overlay").forEach(overlay => {
        bindBackdropClick(overlay, () => {
            overlay.classList.add("hidden");
            resetCwlOverlayState();
        });
    });
}

export function initAddPlayersOverlay(refs) {
    refsCache = refs;
    const {
        addPlayersBtn, modalTabBtn, segBtns, selectGroup,
        overlayConfirmTagBtn, cwlInputTag, addSelectedBtn
    } = refs;

    addPlayersBtn.onclick = () => {
        const overlay = document.querySelector("#cwl-overlay-add-players");
        overlay.classList.toggle("hidden");
        setOverlayMessage('');
        updateAddSelectedButton(addSelectedBtn);
        if (!overlay.classList.contains('hidden')) loadAccountSources(addSelectedBtn);
    };

    modalTabBtn.forEach(tab => {
        tab.onclick = () => showMainTab(tab.dataset.tab, modalTabBtn);
    });

    segBtns.forEach(tab => {
        tab.onclick = () => {
            document.querySelector(".modal-seg-btn.active")?.classList.remove("active");
            tab.classList.add("active");
            activeAccountSource = tab.dataset.seg === 'friends' ? 'friends' : 'user';
            showAccountSource(activeAccountSource);
            updateAddSelectedButton(addSelectedBtn);
        };
    });

    overlayConfirmTagBtn.onclick = () => {
        const tag = cwlInputTag.value.trim();
        if (!tag) return;
        setButtonBusy(overlayConfirmTagBtn, true);
        getPlayerBasicData(tag)
            .then(data => {
                const result = createPlayerCard(data);
                handlePlayerAddResult(result);
            })
            .catch(() => {
                getClanMembersBasicData(tag)
                    .then(players => handlePlayerAddResult(createPlayerCard(players)))
                    .catch(error => {
                        console.error(error);
                        setOverlayMessage(t('cwl.playerAddError'), 'error');
                    });
            })
            .finally(() => setButtonBusy(overlayConfirmTagBtn, false));
    };

    addSelectedBtn?.addEventListener('click', () => {
        const selected = Array.from(document.querySelectorAll('#cwl-account-list .cwl-player-article.selected'))
            .map(card => card._cwlPlayer)
            .filter(Boolean);
        if (!selected.length) return;
        const result = createPlayerCard(uniquePlayers(selected));
        document.querySelectorAll('#cwl-account-list .cwl-player-article.selected')
            .forEach(card => card.classList.remove('selected'));
        updateAddSelectedButton(addSelectedBtn);
        handlePlayerAddResult(result);
    });

    window.addEventListener('clashtools:cwl-preview-selection-changed', () => updateAddSelectedButton(addSelectedBtn));
    window.addEventListener('clashtools:cwl-player-duplicate', () => setOverlayMessage(t('cwl.accountAlreadyInPlanner'), 'warning'));
    window.addEventListener('clashtools:cwl-close-add-player-overlay', closeAndResetAddPlayersOverlay);

    loadAccountSources(addSelectedBtn);
    initGroupOverlay(selectGroup, refs);
}

function handlePlayerAddResult(result = {}) {
    if (result.added > 0) {
        closeAndResetAddPlayersOverlay();
        return;
    }
    if (result.skipped > 0) setOverlayMessage(t('cwl.accountAlreadyInPlanner'), 'warning');
}

function showMainTab(tabName, modalTabBtn) {
    document.querySelector(".modal-tab-btn.active")?.classList.remove("active");
    Array.from(modalTabBtn).find(tab => tab.dataset.tab === tabName)?.classList.add("active");
    document.querySelector("#modal-tab-tag").classList.toggle("hidden", tabName !== "tag");
    document.querySelector("#modal-tab-accounts").classList.toggle("hidden", tabName !== "accounts");
    document.querySelector("#modal-tab-group").classList.toggle("hidden", tabName !== "group");
    document.querySelector(".modal-group-preview-list")?.classList.toggle("hidden", tabName !== "group");
    if (tabName === "accounts") showAccountSource(activeAccountSource);
}

function showAccountSource(source) {
    showAccountEmptyState();
    document.querySelectorAll("#cwl-account-list .cwl-player-article").forEach(card => {
        const visible = card.dataset.source === source;
        card.classList.toggle("hidden", !visible);
        if (visible) hideAccountEmptyState();
    });
}

function showAccountEmptyState() {
    document.querySelector("#modal-account-list-empty")?.classList.remove("hidden");
}

function hideAccountEmptyState() {
    document.querySelector("#modal-account-list-empty")?.classList.add("hidden");
}

function updateAddSelectedButton(button) {
    if (!button) return;
    const count = document.querySelectorAll('#cwl-account-list .cwl-player-article.selected').length;
    button.textContent = t('cwl.addSelectedCount', { count });
}

function resetAccountList() {
    const list = document.querySelector("#cwl-account-list");
    const empty = document.querySelector("#modal-account-list-empty");
    if (list && empty) list.replaceChildren(empty);
    showAccountEmptyState();
}

function setOverlayMessage(message, state = '') {
    const container = document.querySelector('#cwl-container-add-players');
    if (!container) return;
    let node = container.querySelector('.cwl-overlay-message');
    if (!node) {
        node = document.createElement('p');
        node.className = 'cwl-overlay-message';
        container.appendChild(node);
    }
    node.textContent = message || '';
    node.dataset.state = state;
    node.classList.toggle('hidden', !message);
}

function setButtonBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.dataset.loading = busy ? 'true' : 'false';
}

function closeAndResetAddPlayersOverlay() {
    document.querySelector('#cwl-overlay-add-players')?.classList.add('hidden');
    resetCwlOverlayState();
}

export function resetCwlOverlayState() {
    accountLoadToken += 1;
    activeAccountSource = 'user';
    document.querySelector('#cwl-input-tag') && (document.querySelector('#cwl-input-tag').value = '');
    document.querySelector('#cwl-input-clan-clancode') && (document.querySelector('#cwl-input-clan-clancode').value = '');
    document.querySelectorAll('#cwl-account-list .cwl-player-article.selected, #cwl-group-preview-list .cwl-player-article.selected')
        .forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.modal-tab-btn').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === 'tag'));
    document.querySelectorAll('.modal-seg-btn').forEach(tab => tab.classList.toggle('active', tab.dataset.seg === 'mine'));
    document.querySelector('#modal-tab-tag')?.classList.remove('hidden');
    document.querySelector('#modal-tab-accounts')?.classList.add('hidden');
    document.querySelector('#modal-tab-group')?.classList.add('hidden');
    document.querySelector('.modal-group-preview-list')?.classList.add('hidden');
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
    setOverlayMessage('');
    updateAddSelectedButton(refsCache.addSelectedBtn || document.querySelector('#cwl-overlay-add-selected-button'));
}

function option(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
}

function loadAccountSources(addSelectedBtn) {
    const token = ++accountLoadToken;
    const userId = getCurrentUserId();
    resetAccountList();
    if (!userId) return;

    getUserBases(userId)
        .then(data => {
            if (token !== accountLoadToken) return;
            const accounts = data?.[0]?.accounts;
            if (Array.isArray(accounts) && accounts.length > 0) {
                createPlayerCard(accounts, "user");
                showAccountSource(activeAccountSource);
                updateAddSelectedButton(addSelectedBtn);
            }
        })
        .catch(error => console.error(error));

    getFriends(userId)
        .then(data => {
            if (token !== accountLoadToken || !Array.isArray(data)) return;
            data.filter(friend => !friend.status || friend.status === 'accepted').forEach(friend => {
                const friendId = friend.user_a === userId ? friend.user_b : friend.user_a;
                if (!friendId || friendId === userId) return;
                getUserBases(friendId).then(userData => {
                    if (token !== accountLoadToken) return;
                    const accounts = userData?.[0]?.accounts;
                    if (Array.isArray(accounts) && accounts.length > 0) {
                        createPlayerCard(accounts, "friends");
                        showAccountSource(activeAccountSource);
                        updateAddSelectedButton(addSelectedBtn);
                    }
                });
            });
        })
        .catch(error => console.error(error));
}

export function initAddClanButton(refs) {
    const { addClanBtn, overlayAddClanBtn, cwlInputClanCode, selectAmountPlayers } = refs;

    addClanBtn.addEventListener("click", () => {
        document.querySelector("#cwl-overlay-add-clan").classList.remove("hidden");
        ensureCwlSizeOptions(selectAmountPlayers);
    });

    overlayAddClanBtn.addEventListener("click", () => {
        const clanID = cwlInputClanCode.value.trim();
        if (clanID !== "") {
            setButtonBusy(overlayAddClanBtn, true);
            getClanInfoRequest(clanID)
                .then(data => {
                    const leagueName = data?.warLeague?.name || "";
                    const allowThirty = allowsThirtyPlayerCwl(leagueName);
                    applyCwlSizeRestriction(selectAmountPlayers, allowThirty, leagueName);
                    createClanCard(data, allowThirty ? selectAmountPlayers.value : "15");
                    document.querySelector("#cwl-overlay-add-clan")?.classList.add("hidden");
                    cwlInputClanCode.value = "";
                    applyCwlSizeRestriction(selectAmountPlayers, true);
                })
                .catch(error => console.error(error))
                .finally(() => setButtonBusy(overlayAddClanBtn, false));
        }
    });
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
