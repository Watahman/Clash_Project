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
import { initProfileSettings, resetProfileSettings, syncProfileSettings } from "./profile_settings.js";
import { signOut } from "../auth/auth-client.js";
import { invalidateUserCache } from "../cache/local-cache.js";
import { getNotifications, markNotificationRead } from "../Supabase/Supabase-Notifications.js";

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
let notificationsBtn, notificationsCount, notificationsPanel, notificationsClose, notificationsList;
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

export function profileHTML(options = {}) {
    const placeholder = document.querySelector(".profile-placeholder");
    if (!placeholder) return;

    fetch(getProfilePopupPath())
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
            if (options.preload !== false) preloadProfileData();
            clickToCloseOverlays();
        })
        .catch(() => {
            const message = document.createElement('p');
            message.className = 'profile-load-error';
            message.setAttribute('role', 'status');
            message.textContent = t('profile.loadError');
            placeholder.replaceChildren(message);
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
    notificationsBtn   = document.querySelector('#po-notifications-btn');
    notificationsCount = document.querySelector('#po-notifications-count');
    notificationsPanel = document.querySelector('#po-notifications-panel');
    notificationsClose = document.querySelector('#po-notifications-close');
    notificationsList  = document.querySelector('#po-notifications-list');
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
    notificationsBtn.onclick = () => notificationsPanel.classList.toggle('hidden');
    notificationsClose.onclick = () => notificationsPanel.classList.add('hidden');

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
            res.forEach(friend => { createFriendRequestCard(friend); });
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
            res.forEach(friend => { createFriendPendingCard(friend); });
        });
    };

    poLogoutBtn.onclick = async () => {
        const userId = getCurrentUserId();
        poLogoutBtn.disabled = true;
        try {
            await signOut();
        } finally {
            await invalidateUserCache(userId);
            [
                'planner_id',
                'clashtools_planner_cache',
                'clashtoolsOpenGroupId'
            ].forEach(key => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            window.location.href = window.location.pathname.includes('/subPages/')
                ? '../index.html'
                : './index.html';
        }
    };

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!addBase.classList.contains('hidden') ||
            !addClan.classList.contains('hidden') ||
            !friendList.classList.contains('hidden')) {
            closeProfileMiniOverlay(addBase);
            closeProfileMiniOverlay(addClan);
            friendList.classList.add('hidden');
            return;
        }
        closeProfile();
    });

    initProfileSettings({
        onRefreshProfile: () => refreshProfileData(false),
        onProfileUpdated: (profileData) => {
            cachedProfile = { ...cachedProfile, ...profileData };
        }
    });
}

function clearProfileRenderedItems() {
    document.querySelectorAll(".po-card-base, .po-card-friend, .po-card-clan").forEach(el => el.remove());
    friendListContent?.querySelectorAll(".po-base-item").forEach(el => el.remove());
}

function preloadProfileData() {
    const userId = getCurrentUserId();
    if (!userId) return;
    refreshProfileData(false).catch(() => {});
}

function refreshProfileData(openAfterLoad = false) {
    const userId = getCurrentUserId();
    if (!userId) return Promise.resolve(null);

    if (openAfterLoad && cachedProfile) {
        openProfile(
            cachedProfile.name,
            cachedProfile.code ? `#${cachedProfile.code}` : '',
            cachedProfile.created_at?.split("T")[0]
        );
    } else if (openAfterLoad) {
        openProfile(t('profile.loading'), '', '');
        profile.setAttribute('aria-busy', 'true');
    }

    return Promise.all([
        checkUserId(userId),
        getFriends(userId),
        getGroupsOfUser(userId),
        getNotifications(userId).catch(() => ({ unread: 0, items: [] }))
    ]).then(([userData, friends = [], groups = [], notifications]) => {
        if (!userData || userData.error) return null;
        cachedProfile = userData;
        syncProfileSettings(userData);
        clearProfileRenderedItems();
        resetClansLoaded();
        emptyLabel.textContent = t('profile.noBases');
        emptyLabel.classList.remove('hidden');
        loadBases(userData.accounts || [], emptyLabel, true);
        renderFriends(Array.isArray(friends) ? friends : [], emptyLabel, true);
        renderGroups(Array.isArray(groups) ? groups : [], emptyLabel, true);
        renderNotifications(notifications);
        applyActiveProfileTab();
        if (openAfterLoad) {
            openProfile(userData.name, "#" + userData.code, userData.created_at?.split("T")[0]);
        }
        profile.removeAttribute('aria-busy');
        return userData;
    }).catch(error => {
        profile.removeAttribute('aria-busy');
        if (openAfterLoad && poUsername) poUsername.textContent = t('profile.loadError');
        return null;
    });
}

function renderNotifications(data) {
    if (!notificationsList || !notificationsCount) return;
    const items = Array.isArray(data?.items) ? data.items : [];
    const unread = Number(data?.unread || items.filter(item => !item.read_at).length);
    notificationsCount.textContent = String(unread);
    notificationsCount.classList.toggle('hidden', unread === 0);
    notificationsList.replaceChildren();
    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'po-notifications-empty';
        empty.textContent = t('notifications.empty');
        notificationsList.appendChild(empty);
        return;
    }
    items.forEach(notification => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'po-notification-item';
        button.classList.toggle('unread', !notification.read_at);
        const title = document.createElement('strong');
        title.textContent = notification.title || t('notifications.title');
        const body = document.createElement('span');
        body.textContent = notification.type === 'poll_reminder'
            ? t('notifications.pollReminderBody')
            : notification.body || '';
        button.append(title, body);
        button.addEventListener('click', async () => {
            if (!notification.read_at) {
                await markNotificationRead(getCurrentUserId(), notification.id).catch(() => null);
                notification.read_at = new Date().toISOString();
                button.classList.remove('unread');
                const nextUnread = Math.max(0, Number(notificationsCount.textContent || 0) - 1);
                notificationsCount.textContent = String(nextUnread);
                notificationsCount.classList.toggle('hidden', nextUnread === 0);
            }
            if (notification.related_group_id) {
                sessionStorage.setItem('clashtoolsOpenGroupId', notification.related_group_id);
                window.location.href = window.location.pathname.includes('/subPages/')
                    ? './groups.html'
                    : './subPages/groups.html';
            }
        });
        notificationsList.appendChild(button);
    });
}

function openProfile(username, code, memberSince) {
    poUsername.textContent = username || 'User';
    poCode.textContent = code || '';
    poMemberSince.textContent = memberSince ? t('profile.memberSince', { date: memberSince }) : '/';
    syncProfileSettings(cachedProfile);
    resetProfileSettings();
    profile.classList.add('po-open');
    document.body.style.overflow = 'hidden';
    poTab(activeTab, tabRefs);
}

function applyActiveProfileTab() {
    const currentTab = document.querySelector('.po-tab.po-tab-active') || activeTab;
    if (currentTab && tabRefs) poTab(currentTab, tabRefs);
}

function closeProfile() {
    profile.classList.remove('po-open');
    document.body.style.overflow = '';
    resetProfileSettings();
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
        if (e.target === addBase) closeProfileMiniOverlay(addBase)
    })

    addClan.addEventListener('click', (e) => {
        if (e.target === addClan) closeProfileMiniOverlay(addClan)
    })

    friendList.addEventListener('click', (e) => {
        if (e.target === friendList) friendList.classList.add('hidden')
    })
}

function closeProfileMiniOverlay(overlay) {
    overlay.classList.add('hidden');
    overlay.querySelectorAll('input').forEach(input => { input.value = ''; });
    overlay.querySelectorAll('.po-popup-message').forEach(message => {
        message.textContent = '';
        message.classList.add('hidden');
    });
    overlay.querySelectorAll('button').forEach(button => { button.disabled = false; });
}
