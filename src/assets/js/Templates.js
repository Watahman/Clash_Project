import {getUserInfo} from "./Supabase/Supabase-User.js";
import {acceptFriendRequest, rejectFriendRequest} from "./Supabase/Supabase-Friend.js";
import {getGroupInfo, getGroupMembers} from "./Supabase/Supabase-Group.js";

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

    getUserInfo(friendId).then(data => {
        friendRequestTemplateCopy.querySelector(".po-base-name").textContent = data[0].name;
        friendRequestTemplateCopy.querySelector(".po-base-info").textContent = data[0].code;
        friendRequestTemplateCopy.querySelector(".po-friend-accept").onclick = () => {
            acceptFriendRequest(localStorage.getItem("id"), data[0].id).then(() => {
                const card = friendRequestTemplateCopy.querySelector(".po-base-item")
                card.remove()
                createFriendCard(friendId)
            })
        };
        friendRequestTemplateCopy.querySelector(".po-friend-reject").onclick = () => {
            rejectFriendRequest(localStorage.getItem("id"), data[0].id).then(() => {
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

    getUserInfo(friendId).then(data => {
        const item = friendTemplateCopy.querySelector(".po-base-item")
        friendTemplateCopy.querySelector(".po-base-name").textContent = data[0].name
        friendTemplateCopy.querySelector(".po-base-info").textContent = "#" + data[0].code
        if (activeTab.id !== "po-tab-friends") item.classList.add('hidden')
        document.querySelector(".po-panel-content").appendChild(friendTemplateCopy)
    })
}

export function createFriendPendingCard(friendId){
    const friendPendingTemplateCopy = document.querySelector("#po-friend-pending-template").content.cloneNode(true)

    getUserInfo(friendId).then(data => {
        friendPendingTemplateCopy.querySelector(".po-base-name").textContent = data[0].name
        friendPendingTemplateCopy.querySelector(".po-base-info").textContent = "#" + data[0].code
        document.querySelector(".po-friend-list-content").appendChild(friendPendingTemplateCopy)
    })
}

export function createGroupCard(groupsInfo){
    groupsInfo.forEach((group) => {
        const groupCard = document.querySelector("#groups-item-template").content.cloneNode(true)
        getGroupInfo(group.group_id).then(groupData => {
            getGroupMembers(groupData[0].id).then(groupMembers => {
                console.log(groupCard)
                groupCard.querySelector(".groups-item-meta").textContent = groupMembers.length + " leden"
                groupCard.querySelector(".groups-item-name").textContent = groupData[0].name
                if(localStorage.getItem("id") === groupData[0].owner_id){
                    groupCard.querySelector(".groups-role-badge").textContent = "Leader"
                    groupCard.querySelector(".groups-role-badge").classList.add("leader")
                }
                groupCard.querySelector(".groups-item").onclick = () => {
                    document.querySelector("#groups-member-list").replaceChildren()
                    openGroup(groupData[0], groupMembers)
                }

                document.querySelector("#groups-list").appendChild(groupCard)
                document.querySelector(".groups-empty").classList.add("hidden")
            })
        })
    })
}

function openGroup(data, groupMembers){
    document.querySelector("#groups-detail-empty").classList.add("hidden")
    document.querySelector("#groups-detail-content").classList.remove("hidden")
    document.querySelector("#groups-detail-name").textContent = data.name
    document.querySelector("#groups-detail-count").textContent = groupMembers.length + " Leden"
    document.querySelector("#groups-detail-code-text").textContent = data.code
    document.querySelector("#groups-detail-since").textContent = "since - " + data.created_at.split("T")[0]
    const roleBadge = document.querySelector("#groups-detail-role")
    roleBadge.classList.remove("leader")

    if(localStorage.getItem("id") === data.owner_id){
        roleBadge.textContent = "Leader"
        roleBadge.classList.add("leader")
    }else{
        roleBadge.textContent = "Lid"
    }
    addAllMembers(groupMembers, data.owner_id)
}

function addAllMembers(groupMembers, creatorId){
    const memberList = document.querySelector("#groups-member-list")
    const emptyEl = memberList.querySelector(".groups-empty")

    groupMembers.forEach(member => {
        const groupMemberCard = document.querySelector("#groups-member-template").content.cloneNode(true)
        getUserInfo(member.user_id).then(userData => {
            groupMemberCard.querySelector(".groups-member-name").textContent = userData[0].name
            if(userData[0].id === creatorId){
                groupMemberCard.querySelector(".groups-role-badge").textContent = "Leader"
                groupMemberCard.querySelector(".groups-role-badge").classList.add("leader")
            }
            memberList.appendChild(groupMemberCard)
            if(emptyEl) emptyEl.classList.add("hidden")  // null-check voor de zekerheid
        })
    })
}