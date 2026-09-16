import { AUTH_STATES, resolveAuthState } from '../auth/auth-client.js?v=20260915-auth-policy-v1';
import { getFixture } from '../fixtures/fixture-mode.js';

async function canInitialize() {
    const fixture = await getFixture().catch(() => null);
    if (fixture?.module === 'advanced-stats') return true;
    const authState = await resolveAuthState().catch(() => null);
    return authState?.status === AUTH_STATES.AUTHENTICATED;
}

if (await canInitialize()) {
    await import('./advanced-stats.js?v=20260913-advanced-dashboard-v2');
}
