import * as authClient from '../auth/auth-client.js?v=20260829-public-auth-v1';

function authExport(name) {
    try {
        return authClient[name];
    } catch {
        return undefined;
    }
}

function authStatus(name) {
    return authExport('AUTH_STATES')?.[name]
        || name.toLowerCase().replace('_', '-');
}

function authState(status, session = null, error = null) {
    return { status: authStatus(status), session, error };
}

export function createOperationBoardAccess({
    isFixture = () => false,
    onAuthUnavailable = () => {}
} = {}) {
    let currentState = null;
    let authUnsubscribe;
    let authIdentity = '';

    function setAuthState(nextState) {
        currentState = nextState?.status
            ? nextState
            : authState('GUEST');
        authIdentity = getAuthIdentity(currentState);
        return currentState;
    }

    function getAuthIdentity(state = currentState) {
        return `${state?.status || ''}:${state?.session?.user?.id || ''}`;
    }

    function getAuthState() {
        return currentState;
    }

    function bindAuthTransitions(onTransition) {
        const subscribe = authExport('onAuthStateChange');
        if (typeof subscribe !== 'function') return () => {};
        authUnsubscribe?.();
        authUnsubscribe = subscribe((session, state) => {
            const nextState = state?.status
                ? state
                : authState(session ? 'AUTHENTICATED' : 'GUEST', session);
            const nextIdentity = getAuthIdentity(nextState);
            if (nextIdentity === authIdentity) {
                currentState = nextState;
                return;
            }
            const previousState = currentState;
            currentState = nextState;
            authIdentity = nextIdentity;
            onTransition?.(nextState, previousState);
        });
        return () => {
            authUnsubscribe?.();
            authUnsubscribe = null;
        };
    }

    function isAuthenticated() {
        return currentState?.status === authStatus('AUTHENTICATED')
            || Boolean(currentState?.session?.user?.id);
    }

    async function resolveState() {
        try {
            const resolver = authExport('resolveAuthState');
            if (typeof resolver === 'function') {
                return setAuthState(await resolver());
            }
            const syncSession = authExport('syncAuthSession');
            const session = await Promise.resolve(
                syncSession ? syncSession() : null
            );
            return setAuthState(
                authState(session ? 'AUTHENTICATED' : 'GUEST', session)
            );
        } catch (error) {
            onAuthUnavailable(error);
            return setAuthState(authState('UNAVAILABLE', null, error));
        }
    }

    async function requireProtectedAction(reason, action) {
        const requireAuth = authExport('requireAuthForAction');
        if (typeof requireAuth !== 'function') {
            return runFallbackAction(action);
        }
        try {
            const getReturnPath = authExport('getCurrentReturnPath');
            const result = await requireAuth({
                action,
                reason,
                returnTo: typeof getReturnPath === 'function'
                    ? getReturnPath()
                    : undefined
            });
            setAuthState(result?.state);
            return result || { executed: false, state: currentState };
        } catch (error) {
            onAuthUnavailable(error);
            return { executed: false, state: currentState, error };
        }
    }

    async function runFallbackAction(action) {
        if (!isAuthenticated()) return { executed: false, state: currentState };
        return {
            executed: true,
            state: currentState,
            result: await action?.(currentState.session)
        };
    }

    async function requestSourceMode(mode) {
        if (mode !== 'plan' || isAuthenticated() || isFixture()) return true;
        const result = await requireProtectedAction('saved-plan-source');
        return result.executed === true;
    }

    async function loadProtectedPlans({
        getFallbackUserId,
        load,
        onLoading,
        onLoaded,
        onError
    } = {}) {
        const userId = isAuthenticated()
            ? currentState?.session?.user?.id || getFallbackUserId?.()
            : null;
        onLoading?.(userId);
        if (!userId && !isAuthenticated()) return;
        try {
            const authorization = await requireProtectedAction(
                'saved-plans',
                session => {
                    const resolvedUserId = session?.user?.id || userId;
                    return resolvedUserId ? load?.(resolvedUserId) : [];
                }
            );
            if (authorization.executed) onLoaded?.(authorization.result || []);
        } catch (error) {
            onError?.(error);
        }
    }

    async function initializeSource({
        sourceBootstrap,
        queryTag = '',
        isDirectTag = () => false,
        prepareDirectSource,
        loadDirect
    } = {}) {
        if (!sourceBootstrap) return;
        if (!sourceBootstrap.usesFixture() && isDirectTag(queryTag)) {
            sourceBootstrap.setMode('direct');
            prepareDirectSource?.();
            await loadDirect?.(queryTag);
            return;
        }
        if (sourceBootstrap.usesFixture() || isAuthenticated()) {
            await sourceBootstrap.loadInitialSource();
            return;
        }
        sourceBootstrap.setMode('direct');
        prepareDirectSource?.();
    }

    async function resolveInitialState({ fixture = false } = {}) {
        return fixture
            ? setAuthState(authState('GUEST'))
            : resolveState();
    }

    return {
        bindAuthTransitions,
        createState: authState,
        getAuthState,
        initializeSource,
        isAuthenticated,
        loadProtectedPlans,
        requestSourceMode,
        requireProtectedAction,
        resolveInitialState,
        resolveState,
        setAuthState
    };
}
