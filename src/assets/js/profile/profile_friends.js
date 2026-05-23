import { getFriends } from "../Supabase/Supabase-Friend.js";
import { addFriend } from "../Supabase/Supabase-Friend.js";
import { createFriendCard } from "../templates/FriendTemplates.js";
import { getCurrentUserId } from "../utils/user.js";

export function loadFriends(emptyLabel) {
    if (document.querySelectorAll(".po-card-friend").length > 0) return;
    getFriends(getCurrentUserId()).then(res => {
        if (res.length === 0) return;
        emptyLabel.classList.add('hidden');
        res.forEach(friend => { createFriendCard(friend.user_b); });
    });
}

export function handleAddFriend(inputClanTag) {
    const friendCode = inputClanTag.value.split("#")[1];
    addFriend(getCurrentUserId(), friendCode)
        .then(confirm => { console.log(confirm); });
}
