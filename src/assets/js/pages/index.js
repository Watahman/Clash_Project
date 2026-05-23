import { profileHTML } from "../profile/profile_popup.js";

function init() {
    document.querySelectorAll('.tool-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const panelId = 'panel-' + tab.dataset.panel;

            document.querySelectorAll('.tool-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(panelId).classList.add('active');
        });
    });
    profileHTML();
}

init();
