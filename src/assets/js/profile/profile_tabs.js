import { t } from '../i18n/i18n.js';
import { handleAddBase } from "./profile_bases.js";
import { handleAddFriend } from "./profile_friends.js";

export function poTab(btn, refs) {
    const {
        profileTabs, emptyLabel, addBtn, poAddText, poSettings,
        friendRequestBtn, friendPendingBtn,
        addBase, addClan,
        overlayAddBaseBtn, overlayAddClanBtn,
        inputBaseTag, inputBaseToken, inputClanTag,
        controller
    } = refs;

    profileTabs.forEach(t => t.classList.remove('po-tab-active'));
    btn.classList.add('po-tab-active');
    refs.activeTab = btn;

    refs.controller.abort();
    refs.controller = new AbortController();

    const isBase     = btn.id === 'po-tab-bases';
    const isFriend   = btn.id === 'po-tab-friends';
    const isClan     = btn.id === 'po-tab-clans';
    const isSettings = btn.id === 'po-tab-settings';

    document.querySelectorAll(".po-card-base").forEach(t => t.classList.toggle('hidden', !isBase));
    document.querySelectorAll(".po-card-friend").forEach(t => t.classList.toggle('hidden', !isFriend));
    document.querySelectorAll(".po-card-clan").forEach(t => t.classList.toggle('hidden', !isClan));

    poSettings.classList.toggle('hidden', !isSettings);
    friendRequestBtn.classList.toggle('hidden', !isFriend);
    friendPendingBtn.classList.toggle('hidden', !isFriend);

    if (isSettings) {
        emptyLabel.classList.add('hidden');
        addBtn.classList.add('hidden');
        addBtn.onclick = null;
        return;
    }

    const baseCards   = document.querySelectorAll(".po-card-base");
    const friendCards = document.querySelectorAll(".po-card-friend");
    const clanCards   = document.querySelectorAll(".po-card-clan");

    const cards =
        isBase   ? baseCards :
        isFriend ? friendCards :
        isClan   ? clanCards : null;

    const emptyText =
        isBase   ? t('profile.noBases') :
        isFriend ? t('profile.noFriends') :
        isClan   ? t('profile.noClans') : 'Empty';

    const addLabel =
        isBase   ? t('profile.addBase') :
        isFriend ? t('profile.addFriend') :
        isClan   ? t('profile.addClan') : 'ADD';

    if (cards && cards.length > 0) {
        emptyLabel.classList.add('hidden');
    } else {
        emptyLabel.textContent = emptyText;
        emptyLabel.classList.remove('hidden');
    }

    poAddText.textContent = addLabel;
    addBtn.classList.remove('hidden');

    if (isBase)   addBtn.onclick = () => openAddOverlay(addBase, overlayAddBaseBtn, () => handleAddBase(inputBaseTag, inputBaseToken));
    if (isFriend) addBtn.onclick = () => openAddOverlay(addClan, overlayAddClanBtn, () => handleAddFriend(inputClanTag));
    if (isClan)   addBtn.onclick = () => openAddOverlay(addClan, overlayAddClanBtn, () => {});
}

function openAddOverlay(overlay, confirmBtn, onConfirm) {
    resetPopupMessage(overlay);
    overlay.querySelectorAll('input').forEach(input => { input.value = ''; });
    overlay.classList.remove('hidden');
    confirmBtn.disabled = false;
    confirmBtn.onclick = () => {
        resetPopupMessage(overlay);
        confirmBtn.disabled = true;
        Promise.resolve(onConfirm())
            .then(() => {
                overlay.querySelectorAll('input').forEach(input => { input.value = ''; });
                overlay.classList.add('hidden');
            })
            .catch(error => {
                showPopupMessage(overlay, error?.message || t('groups.loadError'));
            })
            .finally(() => {
                confirmBtn.disabled = false;
            });
    };
}

function popupMessageNode(overlay) {
    let node = overlay.querySelector('.po-popup-message');
    if (!node) {
        node = document.createElement('p');
        node.className = 'po-popup-message';
        overlay.querySelector('.overlay-container')?.appendChild(node);
    }
    return node;
}

function showPopupMessage(overlay, message) {
    const node = popupMessageNode(overlay);
    node.textContent = message;
    node.classList.remove('hidden');
}

function resetPopupMessage(overlay) {
    const node = overlay.querySelector('.po-popup-message');
    if (!node) return;
    node.textContent = '';
    node.classList.add('hidden');
}
