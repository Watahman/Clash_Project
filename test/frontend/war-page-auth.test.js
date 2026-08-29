import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createWarAuthLifecycle,
    createWarGuestState,
    createWarUnavailableState,
    isWarAuthenticated,
    resolveWarAuthState
} from '../../src/assets/js/war-operation-board/war-page-auth.js?v=20260829-public-auth-v1';
import { createWarSourceGuard } from '../../src/assets/js/war-operation-board/war-clan-source.js?v=20260829-public-auth-v1';

const authStates = {
    LOADING: 'loading',
    GUEST: 'guest',
    AUTHENTICATED: 'authenticated',
    UNAVAILABLE: 'auth-unavailable'
};

const userState = userId => ({
    status: authStates.AUTHENTICATED,
    session: { user: { id: userId } }
});

describe('War Board auth lifecycle', () => {
    let authClient;
    let listener;

    beforeEach(() => {
        listener = null;
        authClient = {
            AUTH_STATES: authStates,
            onAuthStateChange: vi.fn(callback => {
                listener = callback;
                return () => { listener = null; };
            }),
            resolveAuthState: vi.fn()
        };
    });

    it('resolves fixture, unavailable and authenticated states consistently', async () => {
        expect(createWarGuestState(authClient)).toEqual({
            status: 'guest',
            session: null
        });
        expect(createWarUnavailableState(authClient, 'offline')).toEqual({
            status: 'auth-unavailable',
            session: null,
            error: 'offline'
        });
        authClient.resolveAuthState.mockResolvedValue(userState('user-a'));

        await expect(resolveWarAuthState(authClient, { fixture: true }))
            .resolves.toEqual(createWarGuestState(authClient));
        await expect(resolveWarAuthState(authClient)).resolves.toEqual(userState('user-a'));
        expect(isWarAuthenticated(authClient, userState('user-a'))).toBe(true);
        expect(isWarAuthenticated(authClient, createWarGuestState(authClient))).toBe(false);
    });

    it('resets source state for guest and account transitions while ignoring duplicates', async () => {
        let state = userState('user-a');
        const onReset = vi.fn();
        const onAuthenticated = vi.fn();
        const onGuest = vi.fn();
        const lifecycle = createWarAuthLifecycle({
            authClient,
            sourceGuard: createWarSourceGuard(),
            getAuthState: () => state,
            setAuthState: nextState => { state = nextState; },
            onReset,
            onAuthenticated,
            onGuest
        });

        lifecycle.initialize(state);
        lifecycle.bind();
        listener(null, createWarGuestState(authClient));
        await vi.waitFor(() => expect(onGuest).toHaveBeenCalledTimes(1));
        listener(null, userState('user-b'));
        await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
        listener(null, userState('user-b'));
        await Promise.resolve();

        expect(onReset).toHaveBeenCalledTimes(2);
        expect(onAuthenticated).toHaveBeenCalledWith(userState('user-b'));
        expect(state).toEqual(userState('user-b'));
    });

    it('updates pre-ready state without clearing the current board', () => {
        let state = userState('user-a');
        const lifecycle = createWarAuthLifecycle({
            authClient,
            sourceGuard: createWarSourceGuard(),
            getAuthState: () => state,
            setAuthState: nextState => { state = nextState; },
            isReady: () => false,
            onReset: vi.fn()
        });

        lifecycle.initialize(state);
        lifecycle.bind();
        listener(null, createWarGuestState(authClient));

        expect(state).toEqual(createWarGuestState(authClient));
    });
});
