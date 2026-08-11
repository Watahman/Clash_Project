import { checkUserId } from '../Supabase/Supabase-User.js';
import { onUserProfileUpdate } from '../profile/profile-events.js';
import { getNameInitials } from '../utils/name-initials.js';
import { getCurrentUserId } from '../utils/user.js';

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
export async function loadWorkspaceUserIdentity() {
    const userId = getCurrentUserId();
    if (!userId) return;
    try { applyWorkspaceUserIdentity(await checkUserId(userId)); }
    catch { /* Keep the neutral identity when optional profile loading fails. */ }
}

export function subscribeWorkspaceUserIdentity() {
    onUserProfileUpdate(applyWorkspaceUserIdentity);
}
