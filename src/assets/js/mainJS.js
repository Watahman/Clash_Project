import { profileHTML } from './profile/profile_popup.js';
import { initI18n } from './i18n/i18n.js';
import { syncAuthSession } from './auth/auth-client.js';

async function init() {
    initI18n();
    await syncAuthSession().catch(() => null);
    if (document.querySelector('.profile-placeholder') && document.querySelector('#profile-btn')) {
        profileHTML();
    }
}

void init();
