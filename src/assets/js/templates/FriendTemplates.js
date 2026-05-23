import { getUserInfo } from "../Supabase/Supabase-User.js";
import { acceptFriendRequest, rejectFriendRequest } from "../Supabase/Supabase-Friend.js";
import { getCurrentUserId } from "../utils/user.js";

export function createFriendRequestCard(friendId) {
    const friendRequestTemplate = document.querySelector("#po-friend-request-template");
    const friendRequestTemplateCopy = friendRequestTemplate.content.cloneNode(true);

    getUserInfo(friendId).then(data => {
        friendRequestTemplateCopy.querySelector(".po-base-name").textContent = data[0].name;
        friendRequestTemplateCopy.querySelector(".po-base-info").textContent = data[0].code;
        friendRequestTemplateCopy.querySelector(".po-friend-accept").onclick = () => {
            acceptFriendRequest(getCurrentUserId(), data[0].id).then(() => {
                const card = friendRequestTemplateCopy.querySelector(".po-base-item");
                card.remove();
                createFriendCard(friendId);
            });
        };
        friendRequestTemplateCopy.querySelector(".po-friend-reject").onclick = () => {
            rejectFriendRequest(getCurrentUserId(), data[0].id).then(() => {
                const card = friendRequestTemplateCopy.querySelector(".po-base-item");
                card.remove();
            });
        };
        document.querySelector(".po-friend-list-content").appendChild(friendRequestTemplateCopy);
    });
}

export function createFriendCard(friendId) {
    const friendTemplateCopy = document.querySelector("#po-friend-template").content.cloneNode(true);
    const activeTab = document.querySelector(".po-tab-active");

    getUserInfo(friendId).then(data => {
        const item = friendTemplateCopy.querySelector(".po-base-item");
        friendTemplateCopy.querySelector(".po-base-name").textContent = data[0].name;
        friendTemplateCopy.querySelector(".po-base-info").textContent = "#" + data[0].code;
        if (activeTab.id !== "po-tab-friends") item.classList.add('hidden');
        document.querySelector(".po-panel-content").appendChild(friendTemplateCopy);
    });
}

export function createFriendPendingCard(friendId) {
    const friendPendingTemplateCopy = document.querySelector("#po-friend-pending-template").content.cloneNode(true);

    getUserInfo(friendId).then(data => {
        friendPendingTemplateCopy.querySelector(".po-base-name").textContent = data[0].name;
        friendPendingTemplateCopy.querySelector(".po-base-info").textContent = "#" + data[0].code;
        document.querySelector(".po-friend-list-content").appendChild(friendPendingTemplateCopy);
    });
}
