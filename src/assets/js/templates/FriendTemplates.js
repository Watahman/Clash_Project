import { getUserInfo } from "../Supabase/Supabase-User.js";
import { acceptFriendRequest, rejectFriendRequest } from "../Supabase/Supabase-Friend.js";
import { getCurrentUserId } from "../utils/user.js";

function normalizeUser(data) {
    return Array.isArray(data) ? data[0] : data;
}

export function createFriendRequestCard(friendId) {
    const friendRequestTemplate = document.querySelector("#po-friend-request-template");
    const friendRequestTemplateCopy = friendRequestTemplate.content.cloneNode(true);

    getUserInfo(friendId).then(data => {
        const user = normalizeUser(data);
        if (!user || user.error) return;
        friendRequestTemplateCopy.querySelector(".po-base-name").textContent = user.name;
        friendRequestTemplateCopy.querySelector(".po-base-info").textContent = "#" + user.code;
        friendRequestTemplateCopy.querySelector(".po-friend-accept").onclick = () => {
            acceptFriendRequest(getCurrentUserId(), user.id).then(() => {
                const card = friendRequestTemplateCopy.querySelector(".po-base-item");
                card.remove();
                createFriendCard(friendId);
            });
        };
        friendRequestTemplateCopy.querySelector(".po-friend-reject").onclick = () => {
            rejectFriendRequest(getCurrentUserId(), user.id).then(() => {
                const card = friendRequestTemplateCopy.querySelector(".po-base-item");
                card.remove();
            });
        };
        document.querySelector(".po-friend-list-content").appendChild(friendRequestTemplateCopy);
    }).catch(error => console.error(error));
}

export function createFriendCard(friendId) {
    const friendTemplateCopy = document.querySelector("#po-friend-template").content.cloneNode(true);
    const activeTab = document.querySelector(".po-tab-active");

    getUserInfo(friendId).then(data => {
        const user = normalizeUser(data);
        if (!user || user.error) return;
        const item = friendTemplateCopy.querySelector(".po-base-item");
        friendTemplateCopy.querySelector(".po-base-name").textContent = user.name;
        friendTemplateCopy.querySelector(".po-base-info").textContent = "#" + user.code;
        if (activeTab?.id !== "po-tab-friends") item.classList.add('hidden');
        document.querySelector(".po-panel-content").appendChild(friendTemplateCopy);
    }).catch(error => console.error(error));
}

export function createFriendCardFromData(data) {
    const friendTemplateCopy = document.querySelector("#po-friend-template").content.cloneNode(true);
    const activeTab = document.querySelector(".po-tab-active");
    const item = friendTemplateCopy.querySelector(".po-base-item");
    friendTemplateCopy.querySelector(".po-base-name").textContent = data.name;
    friendTemplateCopy.querySelector(".po-base-info").textContent = "#" + data.code;
    if (activeTab?.id !== "po-tab-friends") item.classList.add('hidden');
    document.querySelector(".po-panel-content").appendChild(friendTemplateCopy);
}

export function createFriendPendingCard(friendId) {
    const friendPendingTemplateCopy = document.querySelector("#po-friend-pending-template").content.cloneNode(true);

    getUserInfo(friendId).then(data => {
        const user = normalizeUser(data);
        if (!user || user.error) return;
        friendPendingTemplateCopy.querySelector(".po-base-name").textContent = user.name;
        friendPendingTemplateCopy.querySelector(".po-base-info").textContent = "#" + user.code;
        document.querySelector(".po-friend-list-content").appendChild(friendPendingTemplateCopy);
    }).catch(error => console.error(error));
}
