import { profileHTML } from './profile/profile_popup.js';
import { initI18n } from './i18n/i18n.js';

function init() {
    initI18n();
    if (document.querySelector('.profile-placeholder') && document.querySelector('#profile-btn')) {
        profileHTML();
    }
}

init();
