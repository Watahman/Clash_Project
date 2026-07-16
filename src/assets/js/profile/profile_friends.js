import { getFriends, addFriend } from "../Supabase/Supabase-Friend.js";
import { createFriendCard } from "../templates/FriendTemplates.js";
import { getCurrentUserId } from "../utils/user.js";
import { t } from "../i18n/i18n.js";

export function renderFriends(friends, emptyLabel, force = false) {
    if (force) document.querySelectorAll(".po-card-friend").forEach(el => el.remove());
    if (!Array.isArray(friends) || friends.length === 0) return;
    emptyLabel.classList.add('hidden');
    const showFriends = document.querySelector('#po-tab-friends')?.classList.contains('po-tab-active');
    friends.forEach(friend => {
        if (friend.user_b || friend.user_a || friend.profile?.id) {
            createFriendCard(friend);
            document.querySelectorAll('.po-card-friend').forEach(card => card.classList.toggle('hidden', !showFriends));
        }
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
