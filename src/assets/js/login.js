import {databaseRequest} from "./API/API-Communication.js";
import * as config from "./Data/config.js";

function init(){
    clicklistener()
}

function clicklistener(){
    document.querySelector("#submit-button").addEventListener("click", ()=> {
        const email = document.querySelector("#email").value
        const password = document.querySelector("#password").value

        const path = config._BASE_URL + config._EXT_SUPA_USER_CHECK
        const data = JSON.stringify({
            email: email,
            password: password
        });

        databaseRequest(path, data).then(data=>{
            console.log(data);
            if(data.success){
                localStorage.setItem("id", data.id);
                window.location.href = "../index.html";
            }else{
                console.log("error");
            }
        })
    })
}

init()