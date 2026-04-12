import {databaseRequest} from "./API/API-Communication.js";
import * as config from "./Data/config.js";

function init(){
    clicklistener()
}

function clicklistener(){
    document.querySelector("#submit-button").addEventListener("click", ()=> {
        const name = document.querySelector("#username").value
        const email = document.querySelector("#email").value
        const password = document.querySelector("#password").value
        const password_confirmation = document.querySelector("#password2").value

        if(password === password_confirmation){
            const path = config._BASE_URL + config._EXT_SUPA_USER_MAKE
            const data = JSON.stringify({
                name: name,
                email: email,
                password: password
            });

            databaseRequest(path, data)
        }
    })
}

init()