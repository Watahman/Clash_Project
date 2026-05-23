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
        isBase   ? "No Bases" :
        isFriend ? "No Friends" :
        isClan   ? "No Clans" : "Empty";

    const addLabel =
        isBase   ? "ADD BASE" :
        isFriend ? "ADD FRIEND" :
        isClan   ? "ADD CLAN" : "ADD";

    if (cards && cards.length > 0) {
        emptyLabel.classList.add('hidden');
    } else {
        emptyLabel.textContent = emptyText;
        emptyLabel.classList.remove('hidden');
    }

    poAddText.textContent = addLabel;
    addBtn.classList.remove('hidden');

    if (isBase)   addBtn.onclick = () => openAddOverlay(addBase, overlayAddBaseBtn, () => handleAddBase(inputBaseTag, inputBaseToken));
    if (isFriend) addBtn.onclick = () => openAddOverlay(addBase, overlayAddBaseBtn, () => handleAddFriend(inputClanTag));
    if (isClan)   addBtn.onclick = () => openAddOverlay(addClan, overlayAddClanBtn, () => {});
}

function openAddOverlay(overlay, confirmBtn, onConfirm) {
    overlay.classList.remove('hidden');
    confirmBtn.onclick = () => {
        onConfirm();
        overlay.classList.add('hidden');
    };
}
