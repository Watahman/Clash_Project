import { AUTH_STATES, resolveAuthState } from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { getRedesignFixture } from '../fixtures/redesign-fixture-mode.js';

async function canInitialize() {
    const fixture = await getRedesignFixture().catch(() => null);
    if (fixture?.module === 'advanced-stats') return true;
    const authState = await resolveAuthState().catch(() => null);
    return authState?.status === AUTH_STATES.AUTHENTICATED;
}

if (await canInitialize()) {
    await import('./advanced-stats.js?v=20260830-monthly-trends-v1');
}
