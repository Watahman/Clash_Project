import { syncAuthSession, signOut } from '../auth/auth-client.js';
import { getRedesignFixture } from '../fixtures/redesign-fixture-mode.js';
import { initI18n, t } from '../i18n/i18n.js';
import { getGroupsOfUser } from '../Supabase/Supabase-Group.js';
import {
    getFriendRequests,
    getFriends,
    getPendingFriendRequests
} from '../Supabase/Supabase-Friend.js';
import { checkUserId } from '../Supabase/Supabase-User.js';
import { getCurrentUserId } from '../utils/user.js';
import { initProfileSettings, syncProfileSettings } from '../profile/profile_settings.js';
import {
    resolveFriendRequest,
    sendFriendRequest,
    verifyAndAddAccount
} from '../profile/profile-page-actions.js';
import {
    profileFixtureData,
    renderAccounts,
    renderFriendList,
    renderIdentity,
    renderOverview
} from '../profile/profile-page-view.js';

const state = {
    profile: null,
    friends: [],
    requests: [],
    sent: [],
    groups: [],
    fixture: false,
    friendTab: 'friends'
};

const refs = {};

function initRefs() {
    refs.status = document.querySelector('#profile-status');
    refs.accountDialog = document.querySelector('#account-dialog');
    refs.accountTag = document.querySelector('#profile-account-tag');
    refs.accountToken = document.querySelector('#profile-account-token');
    refs.accountStatus = document.querySelector('#profile-account-status');
    refs.friendDialog = document.querySelector('#friend-dialog');
    refs.friendCode = document.querySelector('#profile-friend-code');
    refs.friendStatus = document.querySelector('#profile-friend-status');
}

function setStatus(message = '', kind = '') {
    refs.status.textContent = message;
    refs.status.dataset.state = kind;
}

function setDialogStatus(element, message = '', kind = '') {
    element.textContent = message;
    element.dataset.state = kind;
}

function renderAll() {
    renderIdentity(state.profile);
    renderOverview(state.profile, state.friends, state.groups);
    renderAccounts(state.profile?.accounts || []);
    renderCurrentFriends();
    syncProfileSettings(state.profile);
}

function renderCurrentFriends() {
    renderFriendList(state.friendTab, state, {
        accept: friendId => void handleFriendResolution(friendId, 'accept'),
        reject: friendId => void handleFriendResolution(friendId, 'reject')
    });
}

async function loadProfileData() {
    setStatus(t('profile.loading'), 'loading');
    const fixture = await getRedesignFixture().catch(() => null);
    if (fixture?.module === 'profile') {
        const fixtureState = profileFixtureData();
        if (fixture.id === 'profile-empty') {
            fixtureState.profile.accounts = [];
            fixtureState.friends = [];
            fixtureState.requests = [];
            fixtureState.sent = [];
            fixtureState.groups = [];
        }
        Object.assign(state, fixtureState, { fixture: true });
        renderAll();
        setStatus();
        return state.profile;
    }
    await syncAuthSession().catch(() => null);
    const userId = getCurrentUserId();
    if (!userId) return null;
    try {
        const values = await Promise.all([
            checkUserId(userId),
            getFriends(userId).catch(() => []),
            getFriendRequests(userId).catch(() => []),
            getPendingFriendRequests(userId).catch(() => []),
            getGroupsOfUser(userId).catch(() => [])
        ]);
        [state.profile, state.friends, state.requests, state.sent, state.groups] = values;
        if (!state.profile || state.profile.error) throw new Error('profile unavailable');
        renderAll();
        setStatus();
        return state.profile;
    } catch {
        setStatus(t('profile.loadError'), 'error');
        return null;
    }
}

function selectProfileTab(tabId, updateHash = true) {
    document.querySelectorAll('[data-profile-tab]').forEach(button => {
        button.setAttribute('aria-selected', String(button.dataset.profileTab === tabId));
    });
    document.querySelectorAll('[data-profile-panel]').forEach(panel => {
        panel.hidden = panel.dataset.profilePanel !== tabId;
    });
    if (updateHash) history.replaceState(null, '', `#${tabId}`);
}

function selectFriendTab(tabId) {
    state.friendTab = tabId;
    document.querySelectorAll('[data-friend-tab]').forEach(button => {
        button.setAttribute('aria-selected', String(button.dataset.friendTab === tabId));
    });
    renderCurrentFriends();
}

async function handleAccountSubmit() {
    const button = document.querySelector('#profile-account-submit');
    button.disabled = true;
    setDialogStatus(refs.accountStatus, t('profilePage.verifying'), 'loading');
    try {
        const account = await verifyAndAddAccount({
            userId: getCurrentUserId(),
            accounts: state.profile?.accounts || [],
            tag: refs.accountTag.value,
            token: refs.accountToken.value,
            fixture: state.fixture
        });
        state.profile.accounts = [...(state.profile.accounts || []), account];
        renderAll();
        refs.accountDialog.close();
        refs.accountDialog.querySelector('form').reset();
    } catch (error) {
        setDialogStatus(refs.accountStatus, error.message || t('profile.accountVerifyFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

async function handleFriendSubmit() {
    const button = document.querySelector('#profile-friend-submit');
    button.disabled = true;
    setDialogStatus(refs.friendStatus, t('profilePage.sending'), 'loading');
    try {
        const pending = await sendFriendRequest({
            userId: getCurrentUserId(),
            code: refs.friendCode.value,
            ownCode: state.profile?.code,
            fixture: state.fixture
        });
        if (pending) state.sent = [...state.sent, pending];
        else state.sent = await getPendingFriendRequests(getCurrentUserId()).catch(() => state.sent);
        selectFriendTab('sent');
        refs.friendDialog.close();
        refs.friendDialog.querySelector('form').reset();
    } catch (error) {
        setDialogStatus(refs.friendStatus, error.message || t('profilePage.requestFailed'), 'error');
    } finally {
        button.disabled = false;
    }
}

async function handleFriendResolution(friendId, action) {
    try {
        await resolveFriendRequest({ userId: getCurrentUserId(), friendId, action, fixture: state.fixture });
        const request = state.requests.find(value => (value.profile?.id || value.id) === friendId);
        state.requests = state.requests.filter(value => (value.profile?.id || value.id) !== friendId);
        if (action === 'accept' && request) state.friends = [...state.friends, request];
        renderAll();
        setStatus();
    } catch {
        setStatus(t('profilePage.requestFailed'), 'error');
    }
}

function bindInteractions() {
    document.querySelectorAll('[data-profile-tab]').forEach(button => {
        button.addEventListener('click', () => selectProfileTab(button.dataset.profileTab));
    });
    document.querySelectorAll('[data-friend-tab]').forEach(button => {
        button.addEventListener('click', () => selectFriendTab(button.dataset.friendTab));
    });
    document.querySelectorAll('[data-open-dialog]').forEach(button => {
        button.addEventListener('click', () => {
            const dialog = document.querySelector(`#${button.dataset.openDialog}`);
            dialog?.showModal();
            dialog?.querySelector('input')?.focus();
        });
    });
    document.querySelector('#profile-account-submit').addEventListener('click', handleAccountSubmit);
    document.querySelector('#profile-friend-submit').addEventListener('click', handleFriendSubmit);
    document.querySelector('#profile-code').addEventListener('click', event => {
        const button = event.currentTarget;
        const code = button.dataset.copyValue;
        if (!code) return;
        if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(code).catch(() => {});
        button.dataset.copyState = 'copied';
        clearTimeout(button.copyFeedbackTimer);
        button.copyFeedbackTimer = setTimeout(() => {
            button.dataset.copyState = 'copy';
        }, 1000);
    });
    document.querySelector('#profile-logout').addEventListener('click', async () => {
        await signOut();
        window.location.assign('/subpages/login.html');
    });
    window.addEventListener('clashtools:language-changed', renderAll);
}

async function init() {
    initI18n();
    initRefs();
    bindInteractions();
    const initialTab = ['overview', 'accounts', 'friends', 'settings'].includes(location.hash.slice(1))
        ? location.hash.slice(1) : 'overview';
    selectProfileTab(initialTab, false);
    const profile = await loadProfileData();
    initProfileSettings({
        onRefreshProfile: loadProfileData,
        onProfileUpdated: updated => {
            state.profile = updated;
            renderIdentity(updated);
        }
    });
    if (profile) syncProfileSettings(profile);
}

const initialProfileLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialProfileLoad);
