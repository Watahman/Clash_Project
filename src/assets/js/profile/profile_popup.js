import { checkUserId } from "../Supabase/Supabase-User.js";
import {getFriendRequests, getFriends, getPendingFriendRequests} from "../Supabase/Supabase-Friend.js";
import { createFriendRequestCard, createFriendPendingCard } from "../templates/FriendTemplates.js";
import { loadBases } from "./profile_bases.js";
import { renderFriends } from "./profile_friends.js";
import { renderGroups, resetClansLoaded } from "./profile_groups.js";
import { poTab } from "./profile_tabs.js";
import { copyWithFeedback, resetCopyFeedback } from "../utils/clipboard.js";
import { getCurrentUserId } from "../utils/user.js";
import {getGroupsOfUser} from "../Supabase/Supabase-Group.js";
import { applyI18n, t } from "../i18n/i18n.js";
import { initProfileSettings, resetProfileSettings, syncProfileSettings } from "./profile_settings.js";
import { signOut } from "../auth/auth-client.js";
import { getNotifications, markNotificationRead } from "../Supabase/Supabase-Notifications.js";
import { bindBackdropClick } from "../utils/backdrop-click.js";
import {
    buildGroupPollHref,
    pollNotificationCopy,
    stageGroupPollNavigation
} from "../notifications/poll-notifications.js";

let profile, closeProfileBtn, userCode, profileTabs, openProfileBtn, activeTab;
let friendRequestBtn, friendPendingBtn, friendList, emptyFriendRequest;
let addBase, addClan, addBtn, emptyLabel;
let poUsername, poCode, poMemberSince, profileLoadingState;
let poIcoCopy, poIcoCheck, poAddText;
let friendListContent, friendListClose;
let overlayAddBaseBtn, overlayAddClanBtn;
let inputBaseTag, inputBaseToken, inputClanTag;
let poLogoutBtn, poSettings;
let friendListTitle;
let notificationsBtn, notificationsCount, notificationsPanel, notificationsClose, notificationsList;
let cachedProfile = null;
let profileMarkupPromise = null;
let profileRefreshPromise = null;
let profileKeyboardBound = false;
let lastFocusedElement = null;
let friendListRequestId = 0;
let friendListTrigger = null;


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
    if (!placeholder) return Promise.resolve(false);
    if (placeholder.dataset.profileReady === 'true') return Promise.resolve(true);
    if (profileMarkupPromise) return profileMarkupPromise;

    profileMarkupPromise = fetch(getProfilePopupPath())
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
            placeholder.dataset.profileReady = 'true';
            return true;
        })
        .catch(() => {
            const message = document.createElement('p');
            message.className = 'profile-load-error';
            message.setAttribute('role', 'status');
            message.textContent = t('profile.loadError');
            placeholder.replaceChildren(message);
            profileMarkupPromise = null;
            return false;
        });
    return profileMarkupPromise;
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
    profileLoadingState = document.querySelector("#po-loading-state");
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

        // The popup markup and styling are preloaded, but account data is not
        // allowed to delay opening. Cached data is shown immediately; without
        // cache the existing loading state is shown while data refreshes.
        void refreshProfileData(true);
    };

    bindBackdropClick(profile, closeProfile);
    closeProfileBtn.onclick = () => { closeProfile(); };
    userCode.onclick = () => { copyWithFeedback(poCode.textContent, poIcoCopy, poIcoCheck); };
    profileTabs.forEach(tab => { tab.onclick = () => { poTab(tab, tabRefs); }; });
    friendListClose.onclick = () => {
        friendListRequestId += 1;
        friendList.classList.add('hidden');
        friendListTrigger?.focus();
    };
    notificationsBtn.onclick = () => {
        const isOpening = notificationsPanel.classList.contains('hidden');
        notificationsPanel.classList.toggle('hidden');
        if (isOpening) window.requestAnimationFrame(() => notificationsClose.focus());
    };
    notificationsClose.onclick = () => {
        notificationsPanel.classList.add('hidden');
        notificationsBtn.focus();
    };

    friendRequestBtn.onclick = () => {
        const userId = getCurrentUserId();
        if (!userId) { redirectToLogin(); return; }
        openFriendList('profile.requests', () => getFriendRequests(userId), createFriendRequestCard, friendRequestBtn);
    };

    friendPendingBtn.onclick = () => {
        const userId = getCurrentUserId();
        if (!userId) { redirectToLogin(); return; }
        openFriendList('profile.pending', () => getPendingFriendRequests(userId), createFriendPendingCard, friendPendingBtn);
    };

    poLogoutBtn.onclick = async () => {
        poLogoutBtn.disabled = true;
        try {
            await signOut();
        } finally {
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

    bindProfileKeyboardOnce();

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

function openFriendList(titleKey, loader, renderItem, trigger) {
    const requestId = ++friendListRequestId;
    friendListTrigger = trigger;
    friendListTitle.textContent = t(titleKey);
    friendListContent.querySelectorAll(".po-base-item").forEach(item => item.remove());
    emptyFriendRequest.textContent = t('profile.loading');
    emptyFriendRequest.classList.remove('hidden');
    friendList.classList.remove('hidden');
    friendList.setAttribute('aria-busy', 'true');
    friendListClose.focus();

    Promise.resolve(loader())
        .then(result => {
            if (requestId !== friendListRequestId) return;
            const items = Array.isArray(result) ? result : [];
            emptyFriendRequest.textContent = t(titleKey);
            emptyFriendRequest.classList.toggle('hidden', items.length > 0);
            items.forEach(renderItem);
        })
        .catch(() => {
            if (requestId !== friendListRequestId) return;
            emptyFriendRequest.textContent = t('profile.loadError');
            emptyFriendRequest.classList.remove('hidden');
        })
        .finally(() => {
            if (requestId === friendListRequestId) friendList.removeAttribute('aria-busy');
        });
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
        profileLoadingState?.classList.remove('hidden');
    }

    if (profileRefreshPromise) {
        return profileRefreshPromise.then(userData => {
            if (openAfterLoad && userData) openProfile(userData.name, `#${userData.code}`, userData.created_at?.split("T")[0]);
            if (openAfterLoad && !userData && poUsername) poUsername.textContent = t('profile.loadError');
            profileLoadingState?.classList.add('hidden');
            return userData;
        });
    }

    profileRefreshPromise = Promise.all([
        checkUserId(userId),
        getFriends(userId),
        getGroupsOfUser(userId),
        getNotifications(userId).catch(() => ({ unread: 0, items: [] }))
    ]).then(([userData, friends = [], groups = [], notifications]) => {
        if (!userData || userData.error) {
            profile.removeAttribute('aria-busy');
            profileLoadingState?.classList.add('hidden');
            if (openAfterLoad && poUsername) poUsername.textContent = t('profile.loadError');
            return null;
        }
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
        profile.removeAttribute('aria-busy');
        profileLoadingState?.classList.add('hidden');
        return userData;
    }).catch(() => {
        profile.removeAttribute('aria-busy');
        profileLoadingState?.classList.add('hidden');
        if (openAfterLoad && poUsername) poUsername.textContent = t('profile.loadError');
        return null;
    }).finally(() => {
        profileRefreshPromise = null;
    });

    return profileRefreshPromise.then(userData => {
        if (openAfterLoad && userData) openProfile(userData.name, `#${userData.code}`, userData.created_at?.split("T")[0]);
        return userData;
    });
}

function renderNotifications(data) {
    if (!notificationsList || !notificationsCount) return;
    const items = Array.isArray(data?.items) ? data.items : [];
    const unread = Number(data?.unread || items.filter(item => !item.read_at).length);
    notificationsCount.textContent = String(unread);
    notificationsCount.classList.toggle('hidden', unread === 0);
    window.dispatchEvent(new CustomEvent('clashtools:notifications-updated', {
        detail: { items }
    }));
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
        const copy = pollNotificationCopy(notification, t);
        const title = document.createElement('strong');
        title.textContent = copy.title;
        const body = document.createElement('span');
        body.textContent = copy.body;
        button.append(title, body);
        button.addEventListener('click', async () => {
            if (!notification.read_at) {
                await markNotificationRead(getCurrentUserId(), notification.id).catch(() => null);
                notification.read_at = new Date().toISOString();
                button.classList.remove('unread');
                const nextUnread = Math.max(0, Number(notificationsCount.textContent || 0) - 1);
                notificationsCount.textContent = String(nextUnread);
                notificationsCount.classList.toggle('hidden', nextUnread === 0);
                window.dispatchEvent(new CustomEvent('clashtools:notifications-updated', {
                    detail: { items }
                }));
            }
            if (notification.related_group_id) {
                const pollHref = buildGroupPollHref(notification, window.location.href);
                stageGroupPollNavigation(notification, sessionStorage, localStorage);
                window.location.href = pollHref || (window.location.pathname.includes('/subPages/')
                    ? './groups.html'
                    : './subPages/groups.html');
            }
        });
        notificationsList.appendChild(button);
    });
}

function openProfile(username, code, memberSince) {
    if (!profile.classList.contains('po-open')) lastFocusedElement = document.activeElement;
    poUsername.textContent = username || 'User';
    poCode.textContent = code || '';
    poMemberSince.textContent = memberSince ? t('profile.memberSince', { date: memberSince }) : '/';
    syncProfileSettings(cachedProfile);
    resetProfileSettings();
    profile.classList.add('po-open');
    document.body.style.overflow = 'hidden';
    poTab(activeTab, tabRefs);
    window.requestAnimationFrame(() => closeProfileBtn?.focus());
}

function applyActiveProfileTab() {
    const currentTab = document.querySelector('.po-tab.po-tab-active') || activeTab;
    if (currentTab && tabRefs) poTab(currentTab, tabRefs);
}

function closeProfile() {
    if (!profile?.classList.contains('po-open')) return;
    profile.classList.remove('po-open');
    document.body.style.overflow = '';
    notificationsPanel?.classList.add('hidden');
    profileLoadingState?.classList.add('hidden');
    profile.removeAttribute('aria-busy');
    resetProfileSettings();
    if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
    lastFocusedElement = null;
}

function bindProfileKeyboardOnce() {
    if (profileKeyboardBound) return;
    document.addEventListener('keydown', handleProfileKeyboard);
    profileKeyboardBound = true;
}

function handleProfileKeyboard(event) {
    if (!profile?.classList.contains('po-open')) return;
    if (event.key === 'Escape') {
        if (!addBase.classList.contains('hidden') || !addClan.classList.contains('hidden') || !friendList.classList.contains('hidden')) {
            const friendListWasOpen = !friendList.classList.contains('hidden');
            closeProfileMiniOverlay(addBase);
            closeProfileMiniOverlay(addClan);
            friendList.classList.add('hidden');
            if (friendListWasOpen) {
                friendListRequestId += 1;
                friendListTrigger?.focus();
            }
            return;
        }
        if (!notificationsPanel.classList.contains('hidden')) {
            notificationsPanel.classList.add('hidden');
            notificationsBtn.focus();
            return;
        }
        closeProfile();
        return;
    }
    if (event.key === 'Tab') trapProfileFocus(event);
}

function trapProfileFocus(event) {
    const activeMiniOverlay = [addBase, addClan, friendList].find(overlay => overlay && !overlay.classList.contains('hidden'));
    const focusRoot = activeMiniOverlay || profile;
    const focusable = Array.from(focusRoot.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
        .filter(element => !element.closest('.hidden'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

function redirectToLogin() {
    const path = window.location.pathname;
    if (path.includes('/subPages/')) {
        window.location.href = './login.html';
    } else {
        window.location.href = './subPages/login.html';
    }
}

function clickToCloseOverlays(){
    bindBackdropClick(addBase, () => closeProfileMiniOverlay(addBase));
    bindBackdropClick(addClan, () => closeProfileMiniOverlay(addClan));
    bindBackdropClick(friendList, () => friendList.classList.add('hidden'));
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
