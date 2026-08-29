import { checkUserId } from '../Supabase/Supabase-User.js?v=20260829-public-auth-v1';
import { AUTH_STATES, getAuthState } from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { onUserProfileUpdate } from '../profile/profile-events.js';
import { getNameInitials } from '../utils/name-initials.js';
import { getCurrentUserId } from '../utils/user.js';

let identityRequestId = 0;
let identityGeneration = 0;

function sessionUserId(state = getAuthState()) {
    return String(state?.session?.user?.id || '').trim();
}

function canWriteIdentity(userId, requestId, generation) {
    const state = getAuthState();
    return requestId === identityRequestId
        && generation === identityGeneration
        && state?.status === AUTH_STATES.AUTHENTICATED
        && sessionUserId(state) === userId
        && getCurrentUserId() === userId;
}

export function applyWorkspaceUserIdentity(userData) {
    const user = Array.isArray(userData) ? userData[0] : userData;
    const name = String(user?.name || '').trim();
    if (!name) return;
    document.querySelectorAll('.workspace-avatar').forEach(avatar => {
        avatar.textContent = getNameInitials(name, 'CT');
        avatar.title = name;
    });
    const profileName = document.querySelector('.workspace-profile-copy strong');
    if (!profileName) return;
    profileName.removeAttribute('data-i18n');
    profileName.textContent = name;
}

export function clearWorkspaceUserIdentity() {
    identityRequestId += 1;
    identityGeneration += 1;
    document.querySelectorAll('.workspace-avatar').forEach(avatar => {
        avatar.textContent = 'CT';
        avatar.removeAttribute('title');
    });
    const profileName = document.querySelector('.workspace-profile-copy strong');
    if (!profileName) return;
    profileName.setAttribute('data-i18n', 'header.user');
    profileName.textContent = t('header.user');
}

export async function loadWorkspaceUserIdentity(
    state = getAuthState(), generation = identityGeneration
) {
    const userId = sessionUserId(state) || getCurrentUserId();
    const requestId = ++identityRequestId;
    identityGeneration = generation;
    if (state?.status !== AUTH_STATES.AUTHENTICATED || !userId) return;
    try {
        const profile = await checkUserId(userId);
        if (canWriteIdentity(userId, requestId, generation)) applyWorkspaceUserIdentity(profile);
    } catch { /* Keep the neutral identity when optional profile loading fails. */ }
}

export function subscribeWorkspaceUserIdentity() {
    return onUserProfileUpdate(profile => {
        const state = getAuthState();
        const userId = sessionUserId(state);
        const profileId = String(profile?.id || profile?.user_id || profile?.userId || '').trim();
        if (state?.status === AUTH_STATES.AUTHENTICATED && userId
            && (!profileId || profileId === userId)) {
            applyWorkspaceUserIdentity(profile);
        }
    });
}
