import { beforeEach, describe, expect, it, vi } from 'vitest';

const source = vi.hoisted(() => ({
    fetchPlan: vi.fn(),
    fetchPlans: vi.fn()
}));

vi.mock('../../src/assets/js/operation-board/operation-board-source.js?v=20260829-public-auth-v1', () => source);

function deferred() {
    let resolve;
    const promise = new Promise(result => { resolve = result; });
    return { promise, resolve };
}

describe('operation board plan store identity boundaries', () => {
    beforeEach(() => {
        vi.resetModules();
        source.fetchPlan.mockReset();
        source.fetchPlans.mockReset();
    });

    it('discards a plan list that finishes after the account changes', async () => {
        const pending = deferred();
        source.fetchPlans.mockReturnValue(pending.promise);
        const { createOperationPlanStore } = await import(
            '../../src/assets/js/operation-board/operation-board-plan-store.js?v=20260829-public-auth-v1'
        );
        const store = createOperationPlanStore();
        store.setIdentity('user-a', 1);
        const load = store.load('user-a');

        store.setIdentity('user-b', 2);
        pending.resolve([{ id: 'private-a', name: 'A plan' }]);

        await expect(load).resolves.toEqual([]);
        await expect(store.resolve('private-a')).resolves.toBeNull();
    });

    it('does not apply a full plan response after an account change', async () => {
        source.fetchPlans.mockResolvedValue([{ id: 'private-a', name: 'A plan' }]);
        const pending = deferred();
        source.fetchPlan.mockReturnValue(pending.promise);
        const { createOperationPlanStore } = await import(
            '../../src/assets/js/operation-board/operation-board-plan-store.js?v=20260829-public-auth-v1'
        );
        const store = createOperationPlanStore();
        store.setIdentity('user-a', 1);
        await store.load('user-a');
        const resolve = store.resolve('private-a');

        store.setIdentity('user-b', 2);
        pending.resolve({ id: 'private-a', name: 'A full plan', info: {} });

        await expect(resolve).resolves.toBeNull();
        await expect(store.resolve('private-a')).resolves.toBeNull();
    });

    it('keeps same-account summary fallback but never exposes it to a guest', async () => {
        const plan = { id: 'private-a', name: 'A plan' };
        source.fetchPlans.mockResolvedValue([plan]);
        source.fetchPlan.mockRejectedValue(new Error('temporary failure'));
        const { createOperationPlanStore } = await import(
            '../../src/assets/js/operation-board/operation-board-plan-store.js?v=20260829-public-auth-v1'
        );
        const store = createOperationPlanStore();
        store.setIdentity('user-a', 1);
        await store.load('user-a');
        await expect(store.resolve('private-a')).resolves.toEqual(plan);

        store.setIdentity('', 2);
        await expect(store.resolve('private-a')).resolves.toBeNull();
    });
});
