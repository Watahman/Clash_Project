import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
    onAuthStateChange: vi.fn()
}));

vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => auth);

const state = (userId, status = 'authenticated') => ({
    status,
    session: userId ? { user: { id: userId } } : null
});

describe('operation board auth transitions', () => {
    beforeEach(() => {
        vi.resetModules();
        auth.onAuthStateChange.mockReset();
    });

    it('reports account changes to invalidate private board state', async () => {
        let listener;
        auth.onAuthStateChange.mockImplementation(callback => {
            listener = callback;
            return () => {};
        });
        const { createOperationBoardAccess } = await import(
            '../../src/assets/js/operation-board/operation-board-access.js?v=20260829-public-auth-v1'
        );
        const access = createOperationBoardAccess();
        access.setAuthState(state('user-a'));
        const transitions = [];
        access.bindAuthTransitions((next, previous) => transitions.push({ next, previous }));

        listener(null, state('', 'guest'));
        listener(null, state('user-b'));

        expect(transitions.map(item => item.next.status)).toEqual(['guest', 'authenticated']);
        expect(transitions[0].previous.session.user.id).toBe('user-a');
        expect(access.getAuthState().session.user.id).toBe('user-b');
    });

    it('does not report duplicate state identities', async () => {
        let listener;
        auth.onAuthStateChange.mockImplementation(callback => {
            listener = callback;
            return () => {};
        });
        const { createOperationBoardAccess } = await import(
            '../../src/assets/js/operation-board/operation-board-access.js?v=20260829-public-auth-v1'
        );
        const access = createOperationBoardAccess();
        access.setAuthState(state('user-a'));
        const transition = vi.fn();
        access.bindAuthTransitions(transition);

        listener(null, state('user-a'));
        listener(null, state('user-a'));

        expect(transition).not.toHaveBeenCalled();
    });
});
