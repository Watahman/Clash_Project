import { getWarSourceUserId } from './war-clan-source.js?v=20260829-public-auth-v1';

function authExport(authClient, name) {
    try {
        return authClient[name];
    } catch {
        return undefined;
    }
}

function authStatus(authClient, name) {
    return authExport(authClient, 'AUTH_STATES')?.[name]
        || name.toLowerCase().replace('_', '-');
}

export function createWarGuestState(authClient) {
    return { status: authStatus(authClient, 'GUEST'), session: null };
}

export function createWarUnavailableState(authClient, error) {
    return {
        status: authStatus(authClient, 'UNAVAILABLE'),
        session: null,
        error
    };
}

export function isWarAuthenticated(authClient, state) {
    return state?.status === authStatus(authClient, 'AUTHENTICATED')
        || Boolean(state?.session?.user?.id);
}

export async function resolveWarAuthState(authClient, { fixture = false } = {}) {
    if (fixture) return createWarGuestState(authClient);
    const resolveState = authExport(authClient, 'resolveAuthState');
    if (typeof resolveState === 'function') return resolveState();
    const syncSession = authExport(authClient, 'syncAuthSession');
    const session = await Promise.resolve(syncSession ? syncSession() : null)
        .catch(() => null);
    return {
        status: session
            ? authStatus(authClient, 'AUTHENTICATED')
            : authStatus(authClient, 'GUEST'),
        session
    };
}

export function createWarAuthLifecycle({
    authClient,
    sourceGuard,
    getAuthState,
    setAuthState,
    isReady = () => true,
    onReset,
    onAuthenticated,
    onGuest
}) {
    let unsubscribe;

    function initialize(state) {
        setAuthState(state);
        sourceGuard.transition(state);
    }

    async function applyTransition(nextState) {
        const previousUserId = getWarSourceUserId(getAuthState());
        const nextUserId = getWarSourceUserId(nextState);
        const transition = sourceGuard.transition(nextState);
        setAuthState(nextState);
        if (previousUserId === nextUserId || !transition.changed) return;

        onReset?.();
        if (isWarAuthenticated(authClient, nextState)) {
            await onAuthenticated?.(nextState);
            return;
        }
        onGuest?.(nextState);
    }

    function bind() {
        const subscribe = authExport(authClient, 'onAuthStateChange');
        if (typeof subscribe !== 'function') return () => {};
        unsubscribe?.();
        unsubscribe = subscribe((session, nextState) => {
            const state = nextState || {
                status: session
                    ? authStatus(authClient, 'AUTHENTICATED')
                    : authStatus(authClient, 'GUEST'),
                session
            };
            if (!isReady()) {
                setAuthState(state);
                sourceGuard.transition(state);
                return;
            }
            void applyTransition(state);
        });
        return () => {
            unsubscribe?.();
            unsubscribe = null;
        };
    }

    return {
        bind,
        initialize,
        isAuthenticated: () => isWarAuthenticated(authClient, getAuthState())
    };
}
