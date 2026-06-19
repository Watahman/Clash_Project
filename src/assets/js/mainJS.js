import { profileHTML } from './profile/profile_popup.js';

function init() {
    if (document.querySelector('.profile-placeholder') && document.querySelector('#profile-btn')) {
        profileHTML();
    }
}

init();
