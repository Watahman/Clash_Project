import { databaseRequestWithBody } from "./API/API-Communication.js";
import * as conf from "./Data/config.js";
import { postPlayerVerifyTokenRequest } from "./API/API-Player.js";
import { getPlayerWithBattleData } from "./API/API-Functions.js";
import { createBaseCard } from "./Templates.js";

export function profileHTML(){
    fetch("/subpages/popup_HTMLs/profile_popup.html")
        .then(res => res.text())
        .then(html => {
            document.querySelector(".profile-placeholder").innerHTML = html;
            profileInit()
        })
}

function profileInit(){
    document.querySelector("#profile-btn").addEventListener('click', () => {
        if(localStorage.getItem("id") !== null){
            const path = conf._BASE_URL + conf._EXT_SUPA_USER_IDCHECK
            const data = {
                id: localStorage.getItem("id")
            }
            databaseRequestWithBody(path, data)
                .then(data => {
                    console.log("data: ", data);
                    openProfile(data.name, "#" + data.code, data.created_at.split("T")[0])
                    loadBases(data.accounts)
            })
        }else{
            window.location.href = "subpages/login.html"
        }
    })
    document.querySelector("#profile-overlay").addEventListener('click', (e) => {poBackdrop(e)})
    document.querySelector("#po-close").addEventListener('click', () => {closeProfile()})
    document.querySelector("#po-code-btn").addEventListener('click', () => {poCopy()})
    document.querySelectorAll(".po-tab").forEach(tab => {tab.addEventListener('click', (e) => {poTab(e.target)})})
}

// aanpassen
function openProfile(username, code, memberSince) {
    document.querySelector("#po-username").textContent = username || 'User';
    document.querySelector("#po-code").textContent = code || '';
    document.querySelector("#po-member-since").textContent = memberSince ? 'Lid sinds ' + memberSince : 'Lid sinds 18 februari';
    document.querySelector("#profile-overlay").classList.add('po-open');
    document.body.style.overflow = 'hidden';
    poTab(document.querySelector(".po-tab-active"))
}

function closeProfile() {
    document.querySelector("#profile-overlay").classList.remove('po-open');
    document.body.style.overflow = '';
}

function poBackdrop(e) {
    if (e.target.id === 'profile-overlay'){
        closeProfile();
    }
}

let controller = new AbortController();
function poTab(btn) {
    document.querySelectorAll('.po-tab').forEach(t => t.classList.remove('po-tab-active'));
    btn.classList.add('po-tab-active');
    switch(btn.id){
        case 'po-tab-bases':
            controller.abort();
            controller = new AbortController();
            if(document.querySelectorAll(".po-base-item").length > 0){
                document.querySelector(".po-empty").classList.add('hidden');
                document.querySelectorAll(".po-base-item").forEach(t => t.classList.remove('hidden'));
            } else {
                document.querySelector(".po-empty").textContent = "No Bases";
                document.querySelector(".po-empty").classList.remove('hidden');
            }
            document.querySelector("#po-add").innerHTML ='' + '<img src="assets/css/pictures/add.svg" alt="add" />ADD BASE';
            document.querySelector("#po-add").classList.remove('hidden');
            document.querySelector("#po-friend-requests-btn").classList.add('hidden');
            document.querySelector("#po-friend-pending-btn").classList.add('hidden');
            document.querySelector("#po-add").onclick = () => {
                document.querySelector("#po-add-base").classList.remove('hidden');
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape') {
                        document.querySelector("#po-add-base").classList.add('hidden');
                    }
                }, { once: true });
                document.querySelector("#po-overlay-add-base-button").onclick = () => {
                    const playerId = document.querySelector("#po-input-base-tag").value;
                    const playerToken = document.querySelector("#po-input-base-token").value;
                    postPlayerVerifyTokenRequest(playerId, playerToken, (confirmation) => {
                    if(confirmation.status === "ok"){
                        getPlayerWithBattleData(playerId, (playerData) => {
                            createBaseCard(playerData[0]);
                            const path = conf._BASE_URL + conf._EXT_SUPA_USER_ADD_ACCOUNT;
                            const data = {
                                id: localStorage.getItem("id"),
                                account: playerData[0]
                            }
                            databaseRequestWithBody(path, data).then(confirm => {console.log(confirm)})
                        });
                    }else{
                        //send error
                    }});
                    document.querySelector("#po-add-base").classList.add('hidden');
                };
            };
            break;
        case 'po-tab-friends':
            controller.abort();
            controller = new AbortController();
            document.querySelectorAll(".po-base-item").forEach(t => t.classList.add('hidden'));
            document.querySelector(".po-empty").textContent = "No Friends";
            document.querySelector(".po-empty").classList.remove('hidden');
            document.querySelector("#po-friend-requests-btn").classList.remove('hidden');
            document.querySelector("#po-friend-pending-btn").classList.remove('hidden');
            document.querySelector("#po-add").innerHTML ='' + '<img src="assets/css/pictures/add.svg" alt="add" />ADD FRIEND';
            document.querySelector("#po-add").classList.remove('hidden');
            document.querySelector("#po-add").onclick = () => {
                document.querySelector("#po-add-clan").classList.remove('hidden');
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape') {
                        document.querySelector("#po-add-clan").classList.add('hidden');
                    }
                }, { once: true });
                document.querySelector("#po-overlay-add-clan-button").onclick = () => {
                    const friendCode = document.querySelector("#po-input-clan-tag").value.split("#")[1];
                    const path = conf._BASE_URL + conf._EXT_SUPA_USER_ADD_FRIEND;
                    const data = {
                        userId: localStorage.getItem("id"),
                        friendCode: friendCode
                    }
                    databaseRequestWithBody(path, data).then(confirm => {console.log(confirm)})
                    document.querySelector("#po-add-clan").classList.add('hidden');
                };
            };
            break;
        case 'po-tab-clans':
            controller.abort();
            controller = new AbortController();
            document.querySelectorAll(".po-base-item").forEach(t => t.classList.add('hidden'));
            document.querySelector(".po-empty").textContent = "No Clans";
            document.querySelector(".po-empty").classList.remove('hidden');
            document.querySelector("#po-friend-requests-btn").classList.add('hidden');
            document.querySelector("#po-friend-pending-btn").classList.add('hidden');
            document.querySelector("#po-add").innerHTML ='' + '<img src="assets/css/pictures/add.svg" alt="add" />ADD CLAN';
            document.querySelector("#po-add").classList.remove('hidden');
            document.querySelector("#po-add").onclick = () => {
                document.querySelector("#po-add-clan").classList.remove('hidden');
                document.addEventListener('keydown', e => {
                    if (e.key === 'Escape') {
                        document.querySelector("#po-add-clan").classList.add('hidden');
                    }
                }, { once: true });
                document.querySelector("#po-overlay-add-clan-button").onclick = () => {
                    document.querySelector("#po-add-clan").classList.add('hidden');
                };
            };
            break;
        case 'po-tab-settings':
            controller.abort();
            controller = new AbortController();
            document.querySelectorAll(".po-base-item").forEach(t => t.classList.add('hidden'));
            document.querySelector(".po-empty").classList.add('hidden');
            document.querySelector("#po-add").classList.add('hidden');
            document.querySelector("#po-friend-requests-btn").classList.add('hidden');
            document.querySelector("#po-friend-pending-btn").classList.add('hidden');
            document.querySelector("#po-add").onclick = null;
            break;
    }
}

let poCopyTimer;
function poCopy() {
    navigator.clipboard.writeText(document.querySelector('#po-code').textContent).catch(() => {});
    document.querySelector('#po-ico-copy').classList.add('po-hidden');
    document.querySelector('#po-ico-check').classList.remove('po-hidden');
    clearTimeout(poCopyTimer);
    poCopyTimer = setTimeout(() => {
        document.querySelector('#po-ico-copy').classList.remove('po-hidden');
        document.querySelector('#po-ico-check').classList.add('po-hidden');
    }, 1800);
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (!document.querySelector("#po-add-base").classList.contains('hidden') ||
            !document.querySelector("#po-add-clan").classList.contains('hidden')) {
            return;
        }

        closeProfile();
    }
});

function loadBases(baseArray){
    if(baseArray.length === 0) return
    document.querySelector(".po-empty").classList.add('hidden');
    baseArray.forEach((element) => {createBaseCard(element)});
}