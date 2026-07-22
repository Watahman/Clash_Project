export const USER_PROFILE_UPDATED_EVENT = 'clashtools:user-profile-updated';

export function publishUserProfileUpdate(profile) {
    if (!profile) return;
    window.dispatchEvent(new CustomEvent(USER_PROFILE_UPDATED_EVENT, {
        detail: profile
    }));
}

export function onUserProfileUpdate(callback) {
    if (typeof callback !== 'function') return () => {};

    const listener = event => callback(event.detail || null);
    window.addEventListener(USER_PROFILE_UPDATED_EVENT, listener);
    return () => window.removeEventListener(USER_PROFILE_UPDATED_EVENT, listener);
}
