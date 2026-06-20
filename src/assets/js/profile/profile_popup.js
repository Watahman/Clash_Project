import { checkUserId } from "../Supabase/Supabase-User.js";
import {getFriendRequests, getFriends, getPendingFriendRequests} from "../Supabase/Supabase-Friend.js";
import { createFriendRequestCard, createFriendPendingCard } from "../templates/FriendTemplates.js";
import { loadBases } from "./profile_bases.js";
import {loadFriends, renderFriends} from "./profile_friends.js";
import {loadClans, renderGroups, resetClansLoaded} from "./profile_groups.js";
import { poTab } from "./profile_tabs.js";
import { copyWithFeedback, resetCopyFeedback } from "../utils/clipboard.js";
import { getCurrentUserId } from "../utils/user.js";
import {getGroupsOfUser} from "../Supabase/Supabase-Group.js";
import { applyI18n, t } from "../i18n/i18n.js";
import { withGlobalLoading } from "../utils/loading-state.js";

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


function normalizeProfileAssetPaths() {
    const prefix = window.location.pathname.includes('/subPages/') ? '../assets/css/pictures/' : 'assets/css/pictures/';
    document.querySelectorAll('[data-profile-src]').forEach(img => {
        img.src = prefix + img.dataset.profileSrc;
    });
}

function getProfilePopupPath() {
    const path = window.location.pathname;
    if (path.includes('/subPages/')) return './popup_HTMLs/profile_popup.html';
    return './subPages/popup_HTMLs/profile_popup.html';
}


// refs object doorgegeven aan profile_tabs zodat die toegang heeft tot DOM-elementen
let tabRefs;

export function profileHTML() {
    const placeholder = document.querySelector(".profile-placeholder");
    if (!placeholder) return;

    withGlobalLoading(() => fetch(getProfilePopupPath())
        .then(res => {
            if (!res.ok) throw new Error("Profile popup kon niet geladen worden");
            return res.text();
        })
        .then(html => {
            placeholder.innerHTML = html;
            normalizeProfileAssetPaths();
            applyI18n(placeholder);
            labelInit();
            profileInit();
            preloadProfileData();
            clickToCloseOverlays();
        })
        .catch(error => console.error(error)), 'Laden...');
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
    resetCopyFeedback(poIcoCopy, poIcoCheck);

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
        if (getCurrentUserId() === null) {
            redirectToLogin();
            return;
        }
        refreshProfileData(true);
    };

    profile.onclick = (e) => { poBackdrop(e); };
    closeProfileBtn.onclick = () => { closeProfile(); };
    userCode.onclick = () => { copyWithFeedback(poCode.textContent, poIcoCopy, poIcoCheck); };
    profileTabs.forEach(tab => { tab.onclick = (e) => { poTab(e.target, tabRefs); }; });
    friendListClose.onclick = () => { friendList.classList.add('hidden'); };

    friendRequestBtn.onclick = () => {
        const userId = getCurrentUserId();
        if (!userId) { redirectToLogin(); return; }
        friendListTitle.textContent = t('profile.requests');
        emptyFriendRequest.textContent = t('profile.requests');
        friendList.classList.remove('hidden');
        getFriendRequests(userId).then(res => {
            friendListContent.querySelectorAll(".po-base-item").forEach(item => item.remove());
            if (res.length === 0) {
                emptyFriendRequest.classList.remove('hidden');
                return;
            }
            emptyFriendRequest.classList.add('hidden');
            res.forEach(friend => { createFriendRequestCard(friend.user_a); });
        });
    };

    friendPendingBtn.onclick = () => {
        const userId = getCurrentUserId();
        if (!userId) { redirectToLogin(); return; }
        friendListTitle.textContent = t('profile.pending');
        emptyFriendRequest.textContent = t('profile.pending');
        friendList.classList.remove('hidden');
        getPendingFriendRequests(userId).then(res => {
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

function clearProfileRenderedItems() {
    document.querySelectorAll(".po-card-base, .po-card-friend, .po-card-clan").forEach(el => el.remove());
    friendListContent?.querySelectorAll(".po-base-item").forEach(el => el.remove());
}

function preloadProfileData() {
    const userId = getCurrentUserId();
    if (!userId) return;
    refreshProfileData(false);
}

function refreshProfileData(openAfterLoad = false) {
    const userId = getCurrentUserId();
    if (!userId) return Promise.resolve(null);

    return withGlobalLoading(() => Promise.all([
        checkUserId(userId),
        getFriends(userId),
        getGroupsOfUser(userId)
    ]).then(([userData, friends = [], groups = []]) => {
        if (!userData || userData.error) return null;
        cachedProfile = userData;
        clearProfileRenderedItems();
        resetClansLoaded();
        emptyLabel.textContent = t('profile.noBases');
        emptyLabel.classList.remove('hidden');
        loadBases(userData.accounts || [], emptyLabel, true);
        renderFriends(Array.isArray(friends) ? friends : [], emptyLabel, true);
        renderGroups(Array.isArray(groups) ? groups : [], emptyLabel, true);
        if (openAfterLoad) {
            openProfile(userData.name, "#" + userData.code, userData.created_at?.split("T")[0]);
        }
        return userData;
    }).catch(error => {
        console.error(error);
        return null;
    }), 'Laden...');
}

function openProfile(username, code, memberSince) {
    poUsername.textContent = username || 'User';
    poCode.textContent = code || '';
    poMemberSince.textContent = memberSince ? t('profile.memberSince', { date: memberSince }) : '/';
    profile.classList.add('po-open');
    document.body.style.overflow = 'hidden';
    poTab(activeTab, tabRefs);
}

function closeProfile() {
    profile.classList.remove('po-open');
    document.body.style.overflow = '';
}

function poBackdrop(e) {
    if (e.target.id === 'profile-overlay') closeProfile();
}

function redirectToLogin() {
    const path = window.location.pathname;
    if (path.includes('/subPages/')) {
        window.location.href = './login.html';
    } else {
        window.location.href = './subPages/login.html';
    }
}

function isUserLoggedIn() {
    if (getCurrentUserId() === null) {
        redirectToLogin();
    } else {
        refreshProfileData(true);
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
