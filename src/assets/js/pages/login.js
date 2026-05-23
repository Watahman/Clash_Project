import { checkUser } from "../Supabase/Supabase-User.js";

function init() {
    clicklistener();
}

function clicklistener() {
    document.querySelector("#submit-button").addEventListener("click", () => {
        const email    = document.querySelector("#email").value;
        const password = document.querySelector("#password").value;

        checkUser(email, password).then(data => {
            console.log(data);
            if (data.success) {
                localStorage.setItem("id", data.id);
                window.location.href = "../index.html";
            } else {
                console.log("error");
            }
        });
    });
}

init();
