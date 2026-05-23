import { checkUserId } from "../Supabase/Supabase-User.js";
import {getFriendRequests, getFriends, getPendingFriendRequests} from "../Supabase/Supabase-Friend.js";
import { createFriendRequestCard, createFriendPendingCard } from "../templates/FriendTemplates.js";
import { loadBases } from "./profile_bases.js";
import {loadFriends, renderFriends} from "./profile_friends.js";
import {loadClans, renderGroups, resetClansLoaded} from "./profile_groups.js";
import { poTab } from "./profile_tabs.js";
import { copyWithFeedback } from "../utils/clipboard.js";
import { getCurrentUserId } from "../utils/user.js";
import {getGroupsOfUser} from "../Supabase/Supabase-Group.js";

let profile, closeProfileBtn, userCode, profileTabs, openProfileBtn, activeTab;
let friendRequestBtn, friendPendingBtn, friendList, emptyFriendRequest;
let addBase, addClan, addBtn, emptyLabel;
let poUsername, poCode, poMemberSince;
let poIcoCopy, poIcoCheck, poAddText;
let friendListContent, friendListClose;
let overlayAddBaseBtn, overlayAddClanBtn;
let inputBaseTag, inputBaseToken, inputClanTag;
let poLogoutBtn, poSettings;
let friendListTitle, poGroupList;
let cachedProfile = null;

// refs object doorgegeven aan profile_tabs zodat die toegang heeft tot DOM-elementen
let tabRefs;

export function profileHTML() {
    fetch("/subpages/popup_HTMLs/profile_popup.html")
        .then(res => res.text())
        .then(html => {
            document.querySelector(".profile-placeholder").innerHTML = html;
            labelInit();
            profileInit();
            preloadProfileData();
            clickToCloseOverlays()
        });
}

function labelInit() {
    profile            = document.querySelector("#profile-overlay");
    closeProfileBtn    = document.querySelector("#po-close");
    userCode           = document.querySelector("#po-code-btn");
    profileTabs        = document.querySelectorAll(".po-tab");
    openProfileBtn     = document.querySelector("#profile-btn");
    activeTab          = document.querySelector(".po-tab-active");
    friendRequestBtn   = document.querySelector("#po-friend-requests-btn");
    friendPendingBtn   = document.querySelector("#po-friend-pending-btn");
    friendList         = document.querySelector("#po-friend-list");
    emptyFriendRequest = document.querySelector("#po-empty-friendrequest");
    addBase            = document.querySelector("#po-add-base");
    addClan            = document.querySelector("#po-add-clan");
    addBtn             = document.querySelector("#po-add");
    emptyLabel         = document.querySelector(".po-empty");
    poUsername         = document.querySelector("#po-username");
    poCode             = document.querySelector("#po-code");
    poMemberSince      = document.querySelector("#po-member-since");
    poIcoCopy          = document.querySelector("#po-ico-copy");
    poIcoCheck         = document.querySelector("#po-ico-check");
    friendListContent  = document.querySelector("#po-friend-list-content");
    friendListClose    = document.querySelector("#po-friend-list-close");
    overlayAddBaseBtn  = document.querySelector("#po-overlay-add-base-button");
    overlayAddClanBtn  = document.querySelector("#po-overlay-add-clan-button");
    inputBaseTag       = document.querySelector("#po-input-base-tag");
    inputBaseToken     = document.querySelector("#po-input-base-token");
    inputClanTag       = document.querySelector("#po-input-clan-tag");
    friendListTitle    = document.querySelector("#po-friend-list-title");
    poAddText          = document.querySelector("#po-add-text");
    poGroupList        = document.querySelector("#po-group-list");
    poLogoutBtn        = document.querySelector("#po-logout-btn");
    poSettings         = document.querySelector(".po-settings");

    tabRefs = {
        profileTabs, emptyLabel, addBtn, poAddText, poSettings,
        friendRequestBtn, friendPendingBtn,
        addBase, addClan,
        overlayAddBaseBtn, overlayAddClanBtn,
        inputBaseTag, inputBaseToken, inputClanTag,
        activeTab,
        controller: new AbortController()
    };
}

function profileInit() {
    openProfileBtn.onclick = () => {
        if (cachedProfile) {
            openProfile(cachedProfile.name, "#" + cachedProfile.code, cachedProfile.created_at.split("T")[0]);
        } else if (getCurrentUserId() === null) {
            redirectToLogin();
        } else {
            isUserLoggedIn();
        }
    };

    profile.onclick = (e) => { poBackdrop(e); };
    closeProfileBtn.onclick = () => { closeProfile(); };
    userCode.onclick = () => { copyWithFeedback(poCode.textContent, poIcoCopy, poIcoCheck); };
    profileTabs.forEach(tab => { tab.onclick = (e) => { poTab(e.target, tabRefs); }; });
    friendListClose.onclick = () => { friendList.classList.add('hidden'); };

    friendRequestBtn.onclick = () => {
        friendListTitle.textContent = "Friend Requests";
        emptyFriendRequest.textContent = "No requests";
        friendList.classList.remove('hidden');
        getFriendRequests(getCurrentUserId()).then(res => {
            friendListContent.querySelectorAll(".po-base-item").forEach(item => item.remove());
            if (res.length === 0) {
                emptyFriendRequest.classList.remove('hidden');
                return;
            }
            emptyFriendRequest.classList.add('hidden');
            res.forEach(friend => { createFriendRequestCard(friend.user_b); });
        });
    };

    friendPendingBtn.onclick = () => {
        friendListTitle.textContent = "Pending";
        emptyFriendRequest.textContent = "No pending requests";
        friendList.classList.remove('hidden');
        getPendingFriendRequests(getCurrentUserId()).then(res => {
            friendListContent.querySelectorAll(".po-base-item").forEach(item => item.remove());
            if (res.length === 0) {
                emptyFriendRequest.classList.remove('hidden');
                return;
            }
            emptyFriendRequest.classList.add('hidden');
            res.forEach(friend => { createFriendPendingCard(friend.user_b); });
        });
    };

    poLogoutBtn.onclick = () => {
        localStorage.clear();
        if (window.location.pathname.includes("index.html")) {
            window.location.reload();
        } else {
            window.location.href = "../index.html";
        }
    };

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!addBase.classList.contains('hidden') ||
            !addClan.classList.contains('hidden') ||
            !friendList.classList.contains('hidden')) {
            addBase.classList.add('hidden');
            addClan.classList.add('hidden');
            friendList.classList.add('hidden');
            return;
        }
        closeProfile();
    });
}

function preloadProfileData() {
    if (getCurrentUserId() === null) return;
    // checkUserId + friends tegelijk starten
    Promise.all([
        checkUserId(getCurrentUserId()),
        getFriends(getCurrentUserId()),
        getGroupsOfUser(getCurrentUserId())
    ]).then(([userData, friends, groups]) => {
        cachedProfile = userData;
        console.log(userData, friends, groups);
        loadBases(userData.accounts, emptyLabel);
        renderFriends(friends, emptyLabel);
        renderGroups(groups, emptyLabel);
    });
}

function openProfile(username, code, memberSince) {
    poUsername.textContent = username || 'User';
    poCode.textContent = code || '';
    poMemberSince.textContent = memberSince ? 'Lid sinds ' + memberSince : '/';
    profile.classList.add('po-open');
    document.body.style.overflow = 'hidden';
    poTab(activeTab, tabRefs);
}

function closeProfile() {
    profile.classList.remove('po-open');
    document.body.style.overflow = '';
    document.querySelectorAll(".po-card-base, .po-card-friend, .po-card-clan").forEach(el => el.remove());
    resetClansLoaded();
}

function poBackdrop(e) {
    if (e.target.id === 'profile-overlay') closeProfile();
}

function redirectToLogin() {
    if (window.location.pathname.includes("index.html")) {
        window.location.href = "subpages/login.html";
    } else {
        window.location.href = "./login.html";
    }
}

function isUserLoggedIn() {
    if (getCurrentUserId() === null) {
        redirectToLogin();
    } else {
        checkUserId(getCurrentUserId()).then(res => {
            cachedProfile = res;
            openProfile(res.name, "#" + res.code, res.created_at.split("T")[0]);
            loadBases(res.accounts, emptyLabel);
            loadFriends(emptyLabel);
            loadClans(emptyLabel);
        });
    }
}

function clickToCloseOverlays(){
    addBase.addEventListener('click', (e) => {
        if (e.target === addBase) addBase.classList.add('hidden')
    })

    addClan.addEventListener('click', (e) => {
        if (e.target === addClan) addClan.classList.add('hidden')
    })

    friendList.addEventListener('click', (e) => {
        if (e.target === friendList) friendList.classList.add('hidden')
    })
}
