import * as conf from './Data/config.js'
import { databaseRequestWithBody } from "./API/API-Communication.js";

export function createBaseCard(baseInfo){
    const baseTemplate = document.querySelector("#po-base-template");
    const baseTemplateCopy = baseTemplate.content.cloneNode(true);
    baseTemplateCopy.querySelector(".po-base-img").src = `../assets/css/pictures/townhalls/Town_Hall${baseInfo.townHallLevel}.png`;
    baseTemplateCopy.querySelector(".po-base-name").textContent = baseInfo.name;
    baseTemplateCopy.querySelector(".po-base-info").textContent = baseInfo.tag;

    document.querySelector(".po-panel-content").appendChild(baseTemplateCopy);
}

export function createFriendRequestCard(friendId){
    const friendRequestTemplate = document.querySelector("#po-friend-request-template")
    const friendRequestTemplateCopy = friendRequestTemplate.content.cloneNode(true);

    const path = conf._BASE_URL + conf._EXT_SUPA_USER_INFO
    const body = {
        id: friendId
    }
    databaseRequestWithBody(path, body).then(data => {
        friendRequestTemplateCopy.querySelector(".po-base-name").textContent = data[0].name;
        friendRequestTemplateCopy.querySelector(".po-base-info").textContent = data[0].code;
        friendRequestTemplateCopy.querySelector(".po-friend-accept").onclick = () => {
            const path = conf._BASE_URL + conf._EXT_SUPA_USER_ACCEPT_FRIEND
            const body = {
                userId: localStorage.getItem("id"),
                friendId: data[0].id
            }
            databaseRequestWithBody(path, body).then(data => {
                const card = friendRequestTemplateCopy.querySelector(".po-base-item")
                card.remove()
                createFriendCard(friendId)
            })
        };
        friendRequestTemplateCopy.querySelector(".po-friend-reject").onclick = () => {
            const path = conf._BASE_URL + conf._EXT_SUPA_USER_REJECT_FRIEND
            const body = {
                userId: localStorage.getItem("id"),
                friendId: data[0].id
            }
            databaseRequestWithBody(path, body).then(data => {
                const card = friendRequestTemplateCopy.querySelector(".po-base-item")
                card.remove()
            })
        };
        document.querySelector(".po-friend-list-content").appendChild(friendRequestTemplateCopy)
    })
}

export function createFriendCard(friendId){
    const friendTemplateCopy = document.querySelector("#po-friend-template").content.cloneNode(true)
    const activeTab = document.querySelector(".po-tab-active")

    const path = conf._BASE_URL + conf._EXT_SUPA_USER_INFO
    const body = { id: friendId }
    databaseRequestWithBody(path, body).then(data => {
        const item = friendTemplateCopy.querySelector(".po-base-item")
        friendTemplateCopy.querySelector(".po-base-name").textContent = data[0].name
        friendTemplateCopy.querySelector(".po-base-info").textContent = "#" + data[0].code
        if (activeTab.id !== "po-tab-friends") item.classList.add('hidden')
        document.querySelector(".po-panel-content").appendChild(friendTemplateCopy)
    })
}