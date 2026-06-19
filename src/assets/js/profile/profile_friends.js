import { getFriends, addFriend } from "../Supabase/Supabase-Friend.js";
import { createFriendCard } from "../templates/FriendTemplates.js";
import { getCurrentUserId } from "../utils/user.js";

export function renderFriends(friends, emptyLabel) {
    if (!Array.isArray(friends) || friends.length === 0) return;
    emptyLabel.classList.add('hidden');
    friends.forEach(friend => {
        const friendId = friend.user_b || friend.user_a;
        if (friendId) createFriendCard(friendId);
    });
}

export function loadFriends(emptyLabel) {
    if (document.querySelectorAll(".po-card-friend").length > 0) return;
    const userId = getCurrentUserId();
    if (!userId) return;
    getFriends(userId).then(res => renderFriends(res, emptyLabel));
}

export function handleAddFriend(inputFriendCode) {
    const userId = getCurrentUserId();
    if (!userId) return;
    const friendCode = inputFriendCode.value.trim().replace(/^#/, "");
    if (!friendCode) return;
    addFriend(userId, friendCode)
        .then(confirm => { console.log(confirm); })
        .catch(error => console.error(error));
}
