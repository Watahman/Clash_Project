import { getFriends, addFriend } from "../Supabase/Supabase-Friend.js";
import { createFriendCard } from "../templates/FriendTemplates.js";
import { getCurrentUserId } from "../utils/user.js";
import { t } from "../i18n/i18n.js";

export function renderFriends(friends, emptyLabel, force = false) {
    if (force) document.querySelectorAll(".po-card-friend").forEach(el => el.remove());
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
    if (!userId) return Promise.reject(new Error(t('auth.login')));
    const friendCode = inputFriendCode.value.trim().replace(/^#/, "");
    if (!friendCode) return Promise.reject(new Error(t('profile.friendCodeMissing')));
    const ownCode = document.querySelector('#po-code')?.textContent?.trim().replace(/^#/, "");
    if (ownCode && ownCode.toUpperCase() === friendCode.toUpperCase()) {
        return Promise.reject(new Error(t('profile.cannotAddSelf')));
    }
    return addFriend(userId, friendCode);
}
