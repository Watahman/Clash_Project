import { initI18n } from '../i18n/i18n.js';
import { createUser } from "../Supabase/Supabase-User.js";

function init() {
    initI18n();
    clicklistener();
}

function clicklistener() {
    document.querySelector("#submit-button").addEventListener("click", () => {
        const name                 = document.querySelector("#username").value;
        const email                = document.querySelector("#email").value;
        const password             = document.querySelector("#password").value;
        const password_confirmation = document.querySelector("#password2").value;

        if (password === password_confirmation) {
            createUser(name, email, password).then(data => {
                console.log(data);
            });
        }
    });
}

init();
