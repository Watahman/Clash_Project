import { acceptFriendRequest, rejectFriendRequest } from "../Supabase/Supabase-Friend.js";
import { getCurrentUserId } from "../utils/user.js";
import { hideProfileEmptyStateFor } from "../profile/profile_empty_state.js";

function friendData(value) {
    if (typeof value === 'string') return { id: value, name: value, code: '' };
    const profile = value?.profile || value || {};
    return {
        id: profile.id || value?.user_b || value?.user_a || '',
        name: profile.name || profile.id || value?.user_b || value?.user_a || '',
        code: profile.code || ''
    };
}

function friendExists(friendId) {
    return Array.from(document.querySelectorAll('.po-card-friend')).some(card => card.dataset.friendId === friendId);
}

export function createFriendRequestCard(friend, options = {}) {
    const friendRequestTemplate = document.querySelector("#po-friend-request-template");
    const friendRequestTemplateCopy = friendRequestTemplate.content.cloneNode(true);
    const user = friendData(friend);
    if (!user.id) return;
    friendRequestTemplateCopy.querySelector(".po-base-name").textContent = user.name;
    friendRequestTemplateCopy.querySelector(".po-base-info").textContent = user.code ? "#" + user.code : '';
    const card = friendRequestTemplateCopy.querySelector(".po-base-item");
    friendRequestTemplateCopy.querySelector(".po-friend-accept").onclick = () => {
        acceptFriendRequest(getCurrentUserId(), user.id).then(() => {
            card.remove();
            createFriendCard({ user_b: user.id, profile: user });
            options.onResolved?.();
        });
    };
    friendRequestTemplateCopy.querySelector(".po-friend-reject").onclick = () => {
        rejectFriendRequest(getCurrentUserId(), user.id).then(() => {
            card.remove();
            options.onResolved?.();
        });
    };
    document.querySelector(".po-friend-list-content").appendChild(friendRequestTemplateCopy);
}

export function createFriendCard(friend) {
    const user = friendData(friend);
    const friendId = user.id;
    if (!friendId || friendExists(friendId)) return;
    const friendTemplateCopy = document.querySelector("#po-friend-template").content.cloneNode(true);
    const activeTab = document.querySelector(".po-tab-active");
    const item = friendTemplateCopy.querySelector(".po-base-item");
    item.dataset.friendId = friendId;
    friendTemplateCopy.querySelector(".po-base-name").textContent = user.name;
    friendTemplateCopy.querySelector(".po-base-info").textContent = user.code ? "#" + user.code : '';
    if (activeTab?.id !== "po-tab-friends") item.classList.add('hidden');
    document.querySelector(".po-panel-content").appendChild(friendTemplateCopy);
    hideProfileEmptyStateFor('po-tab-friends');
}

export function createFriendCardFromData(data) {
    const friendTemplateCopy = document.querySelector("#po-friend-template").content.cloneNode(true);
    const activeTab = document.querySelector(".po-tab-active");
    const item = friendTemplateCopy.querySelector(".po-base-item");
    item.dataset.friendId = data.id || '';
    friendTemplateCopy.querySelector(".po-base-name").textContent = data.name;
    friendTemplateCopy.querySelector(".po-base-info").textContent = "#" + data.code;
    if (activeTab?.id !== "po-tab-friends") item.classList.add('hidden');
    document.querySelector(".po-panel-content").appendChild(friendTemplateCopy);
    hideProfileEmptyStateFor('po-tab-friends');
}

export function createFriendPendingCard(friend) {
    const friendPendingTemplateCopy = document.querySelector("#po-friend-pending-template").content.cloneNode(true);
    const user = friendData(friend);
    if (!user.id) return;
    friendPendingTemplateCopy.querySelector(".po-base-name").textContent = user.name;
    friendPendingTemplateCopy.querySelector(".po-base-info").textContent = user.code ? "#" + user.code : '';
    document.querySelector(".po-friend-list-content").appendChild(friendPendingTemplateCopy);
}
