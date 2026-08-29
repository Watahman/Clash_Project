const AUTH_STATE_EVENT = 'clashtools:planner-auth-state-changed';

export function getPrivateSourceAuthIdentity(state) {
    return `${state?.status || 'legacy'}:${state?.session?.user?.id || ''}`;
}

export function createPrivateSourceAuth({ getFallbackUserId = () => '' } = {}) {
    let authState = null;
    let authIdentity = getPrivateSourceAuthIdentity();
    let requestToken = 0;
    let transitionBound = false;

    const getUserId = () => authState?.session?.user?.id || getFallbackUserId?.() || '';
    const canRead = () => authState
        ? authState.status === 'authenticated' && Boolean(authState.session?.user?.id)
        : Boolean(getUserId());
    const invalidate = () => { requestToken += 1; };
    const configure = state => {
        authState = state || null;
        authIdentity = getPrivateSourceAuthIdentity(authState);
        invalidate();
    };
    const startRequest = () => {
        requestToken += 1;
        return requestToken;
    };
    const isCurrent = (token, userId) => token === requestToken
        && canRead()
        && getUserId() === userId;
    const bind = onTransition => {
        if (transitionBound) return;
        window.addEventListener(AUTH_STATE_EVENT, event => {
            const state = event.detail;
            const nextIdentity = getPrivateSourceAuthIdentity(state);
            if (!state || nextIdentity === authIdentity) return;
            authState = state;
            authIdentity = nextIdentity;
            invalidate();
            onTransition?.(state);
        });
        transitionBound = true;
    };

    return {
        bind,
        canRead,
        configure,
        getState: () => authState,
        getUserId,
        invalidate,
        isCurrent,
        startRequest
    };
}
