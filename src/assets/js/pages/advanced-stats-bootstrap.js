import { syncAuthSession } from '../auth/auth-client.js';
import { profileHTML } from '../profile/profile_popup.js';

await syncAuthSession().catch(() => null);
profileHTML();
await import('./advanced-stats.js?v=20260809-2');
