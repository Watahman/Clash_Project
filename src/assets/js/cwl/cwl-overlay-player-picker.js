import { getClanMembersBasicData, getPlayerBasicData } from "../API/API-Functions.js?v=20260829-public-auth-v1";
import { createPlayerCard } from "../templates/CWLTemplates.js?v=20260830-card-settings";
import { getUserBases } from "../Supabase/Supabase-User.js?v=20260829-public-auth-v1";
import { getFriends } from "../Supabase/Supabase-Friend.js?v=20260829-public-auth-v1";
import { initGroupOverlay } from "./cwl-group.js?v=20260830-card-settings";
import { getCurrentUserId } from "../utils/user.js";
import { uniquePlayers } from "./cwl-utils.js";
import { t } from "../i18n/i18n.js?v=20260829-public-auth-v1";
import { isRedesignFixtureRequested } from "../fixtures/redesign-fixture-mode.js";
import { getCurrentReturnPath, requireAuthForAction } from "../auth/auth-client.js?v=20260829-public-auth-v1";
import { createPrivateSourceAuth } from "./cwl-private-source-auth.js?v=20260829-public-auth-v1";

let activeAccountSource = 'user';
let refsCache = {};
const privateAuth = createPrivateSourceAuth({ getFallbackUserId: getCurrentUserId });

export function initAddPlayersOverlay(refs, onReset = resetPlayerOverlayState) {
    refsCache = refs;
    privateAuth.configure(refs.authState);
    privateAuth.bind(handleAuthStateChange);
    bindPlayerPickerToggle(refs);
    bindPlayerPickerTabs(refs.modalTabBtn, refs.segBtns, refs.addSelectedBtn);
    bindPlayerPickerActions(refs, onReset);
    loadAccountSources(refs.addSelectedBtn);
    if (!isRedesignFixtureRequested() && privateAuth.canRead()) initGroupOverlay(refs.selectGroup, refs);
}

function bindPlayerPickerToggle({ addPlayersBtn, cwlInputTag, addSelectedBtn }) {
    addPlayersBtn.onclick = () => {
        const overlay = document.querySelector("#cwl-overlay-add-players");
        overlay.classList.toggle("hidden");
        setOverlayMessage('');
        updateAddSelectedButton(addSelectedBtn);
        if (!overlay.classList.contains('hidden')) {
            loadAccountSources(addSelectedBtn);
            cwlInputTag?.focus();
        }
    };
}

function bindPlayerPickerTabs(modalTabBtn, segBtns, addSelectedBtn) {
    modalTabBtn.forEach(tab => {
        tab.onclick = () => {
            if (isPrivateSource(tab.dataset.tab) && !privateAuth.canRead()) {
                void requirePrivateSourceAccess();
                return;
            }
            showMainTab(tab.dataset.tab, modalTabBtn);
        };
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
}

function isPrivateSource(tabName) {
    return tabName === 'accounts' || tabName === 'group';
}

function handleAuthStateChange(state) {
    refsCache.authState = state;
    resetPlayerOverlayState();
    resetAccountList();
    if (privateAuth.canRead()) loadAccountSources(refsCache.addSelectedBtn);
}

async function requirePrivateSourceAccess() {
    try {
        await requireAuthForAction({
            reason: 'planner-private-source',
            returnTo: getCurrentReturnPath()
        });
    } catch {
        setOverlayMessage(t('planner.privateSourceUnavailable'), 'error');
    }
}

function bindPlayerPickerActions({ overlayConfirmTagBtn, cwlInputTag, addSelectedBtn }, onReset) {
    overlayConfirmTagBtn.onclick = () => addPlayersByTag(cwlInputTag, overlayConfirmTagBtn, onReset);
    addSelectedBtn?.addEventListener('click', () => addSelectedAccounts(addSelectedBtn, onReset));
    window.addEventListener('clashtools:cwl-preview-selection-changed', () => updateAddSelectedButton(addSelectedBtn));
    window.addEventListener('clashtools:cwl-player-duplicate', () => setOverlayMessage(t('cwl.accountAlreadyInPlanner'), 'warning'));
    window.addEventListener('clashtools:cwl-close-add-player-overlay', () => closeAndResetAddPlayersOverlay(onReset));
}

export function resetPlayerOverlayState() {
    privateAuth.invalidate();
    activeAccountSource = 'user';
    const tagInput = document.querySelector('#cwl-input-tag');
    if (tagInput) tagInput.value = '';
    document.querySelectorAll('#cwl-account-list .cwl-player-article.selected')
        .forEach(card => card.classList.remove('selected'));
    document.querySelectorAll('.modal-tab-btn').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === 'tag'));
    document.querySelectorAll('.modal-seg-btn').forEach(tab => tab.classList.toggle('active', tab.dataset.seg === 'mine'));
    document.querySelector('#modal-tab-tag')?.classList.remove('hidden');
    document.querySelector('#modal-tab-accounts')?.classList.add('hidden');
    document.querySelector('#modal-tab-group')?.classList.add('hidden');
    document.querySelector('.modal-group-preview-list')?.classList.add('hidden');
    setOverlayMessage('');
    updateAddSelectedButton(refsCache.addSelectedBtn || document.querySelector('#cwl-overlay-add-selected-button'));
}

function addPlayersByTag(input, button, onReset) {
    if (isRedesignFixtureRequested()) return;
    const tag = input.value.trim();
    if (!tag) {
        setOverlayMessage(t('cwl.tagLabel'), 'error');
        input.focus();
        return;
    }
    setButtonBusy(button, true);
    getPlayerBasicData(tag)
        .then(data => handlePlayerAddResult(createPlayerCard({ ...data, source: 'tag' }), onReset))
        .catch(() => getClanMembersBasicData(tag)
            .then(players => handlePlayerAddResult(createPlayerCard(
                players.map(player => ({ ...player, source: 'tag' }))
            ), onReset))
            .catch(error => {
                console.error(error);
                setOverlayMessage(t('cwl.playerAddError'), 'error');
            }))
        .finally(() => setButtonBusy(button, false));
}

function addSelectedAccounts(button, onReset) {
    const selected = Array.from(document.querySelectorAll('#cwl-account-list .cwl-player-article.selected'))
        .map(card => card._cwlPlayer)
        .filter(Boolean);
    if (!selected.length) return;
    const players = uniquePlayers(selected).map(player => ({
        ...player,
        source: activeAccountSource === 'friends' ? 'friends' : 'userBase'
    }));
    const result = createPlayerCard(players);
    document.querySelectorAll('#cwl-account-list .cwl-player-article.selected')
        .forEach(card => card.classList.remove('selected'));
    updateAddSelectedButton(button);
    handlePlayerAddResult(result, onReset);
}

function handlePlayerAddResult(result = {}, onReset = resetPlayerOverlayState) {
    if (result.added > 0) {
        closeAndResetAddPlayersOverlay(onReset);
        return;
    }
    if (result.skipped > 0) setOverlayMessage(t('cwl.accountAlreadyInPlanner'), 'warning');
}

function showMainTab(tabName, modalTabBtn) {
    document.querySelector(".modal-tab-btn.active")?.classList.remove("active");
    Array.from(modalTabBtn).find(tab => tab.dataset.tab === tabName)?.classList.add("active");
    document.querySelector("#modal-tab-tag").classList.toggle("hidden", tabName !== "tag");
    document.querySelector("#modal-tab-accounts").classList.toggle(
        "hidden",
        tabName !== "accounts" && tabName !== "friends"
    );
    document.querySelector("#modal-tab-group").classList.toggle("hidden", tabName !== "group");
    document.querySelector(".modal-group-preview-list")?.classList.toggle("hidden", tabName !== "group");
    if (tabName === "accounts" || tabName === "friends") {
        if (tabName === 'friends') {
            activeAccountSource = 'friends';
            document.querySelector('.modal-seg-btn[data-seg="friends"]')?.click();
        }
        showAccountSource(activeAccountSource);
    }
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

function closeAndResetAddPlayersOverlay(onReset) {
    document.querySelector('#cwl-overlay-add-players')?.classList.add('hidden');
    onReset();
}

function loadAccountSources(addSelectedBtn) {
    const token = privateAuth.startRequest();
    resetAccountList();
    if (!privateAuth.canRead()) return;
    const userId = privateAuth.getUserId();
    if (isRedesignFixtureRequested()) return;
    if (!userId) return;
    if (!privateAuth.isCurrent(token, userId)) return;

    getUserBases(userId)
        .then(data => {
            if (!privateAuth.isCurrent(token, userId)) return;
            const accounts = data?.[0]?.accounts;
            if (Array.isArray(accounts) && accounts.length > 0) {
                createPlayerCard(accounts, "user");
                showAccountSource(activeAccountSource);
                updateAddSelectedButton(addSelectedBtn);
            }
        })
        .catch(error => reportAccountLoadError(error, token, userId));

    if (!privateAuth.isCurrent(token, userId)) return;
    getFriends(userId)
        .then(data => loadFriendAccounts(data, userId, token, addSelectedBtn))
        .catch(error => reportAccountLoadError(error, token, userId));
}

function loadFriendAccounts(data, userId, token, addSelectedBtn) {
    if (!privateAuth.isCurrent(token, userId) || !Array.isArray(data)) return;
    data.filter(friend => !friend.status || friend.status === 'accepted').forEach(friend => {
        const friendId = friend.user_a === userId ? friend.user_b : friend.user_a;
        if (!friendId || friendId === userId) return;
        if (!privateAuth.isCurrent(token, userId)) return;
        getUserBases(friendId).then(userData => {
            if (!privateAuth.isCurrent(token, userId)) return;
            const accounts = userData?.[0]?.accounts;
            if (Array.isArray(accounts) && accounts.length > 0) {
                createPlayerCard(accounts, "friends");
                showAccountSource(activeAccountSource);
                updateAddSelectedButton(addSelectedBtn);
            }
        }).catch(error => reportAccountLoadError(error, token, userId));
    });
}

function reportAccountLoadError(error, token, userId) {
    if (token != null && !privateAuth.isCurrent(token, userId)) return;
    console.error(error);
    setOverlayMessage(t('cwl.playerAddError'), 'error');
}
