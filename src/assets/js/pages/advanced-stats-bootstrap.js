import { syncAuthSession } from '../auth/auth-client.js';

await syncAuthSession().catch(() => null);
await import('./advanced-stats.js?v=20260814-advanced-stats-v4');
