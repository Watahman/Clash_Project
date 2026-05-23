import { postPlayerVerifyTokenRequest } from "./API/API-Player.js";
import { getPlayerWithBattleData } from "./API/API-Functions.js";
import { createBaseCard, createFriendRequestCard, createFriendCard, createFriendPendingCard } from "./Templates.js";
import {addFriend, getFriendRequests, getFriends, getPendingFriendRequests} from "./Supabase/Supabase-Friend.js";
import {addBaseToUser, checkUserId} from "./Supabase/Supabase-User.js";
import {getGroupInfo, getGroupsOfUser} from "./Supabase/Supabase-Group.js";

let profile, closeProfileBtn, userCode, profileTabs, openProfileBtn, activeTab
let friendRequestBtn, friendPendingBtn, friendList, emptyFriendRequest
let addBase, addClan, addBtn, emptyLabel
let poUsername, poCode, poMemberSince
let poIcoCopy, poIcoCheck, poAddText
let friendListContent, friendListClose
let overlayAddBaseBtn, overlayAddClanBtn
let inputBaseTag, inputBaseToken, inputClanTag
let poLogoutBtn, poSettings
let controller = new AbortController()
let poCopyTimer
let friendListTitle
let poGroupList
let clansLoaded = false
let cachedProfile = null

export function profileHTML(){
    fetch("/subpages/popup_HTMLs/profile_popup.html")
        .then(res => res.text())
        .then(html => {
            document.querySelector(".profile-placeholder").innerHTML = html;
            labelInit()
            profileInit()
            preloadProfileData()
        })
}

function labelInit(){
    profile           = document.querySelector("#profile-overlay")
    closeProfileBtn   = document.querySelector("#po-close")
    userCode          = document.querySelector("#po-code-btn")
    profileTabs       = document.querySelectorAll(".po-tab")
    openProfileBtn    = document.querySelector("#profile-btn")
    activeTab         = document.querySelector(".po-tab-active")
    friendRequestBtn  = document.querySelector("#po-friend-requests-btn")
    friendPendingBtn  = document.querySelector("#po-friend-pending-btn")
    friendList        = document.querySelector("#po-friend-list")
    emptyFriendRequest= document.querySelector("#po-empty-friendrequest")
    addBase           = document.querySelector("#po-add-base")
    addClan           = document.querySelector("#po-add-clan")
    addBtn            = document.querySelector("#po-add")
    emptyLabel        = document.querySelector(".po-empty")
    poUsername        = document.querySelector("#po-username")
    poCode            = document.querySelector("#po-code")
    poMemberSince     = document.querySelector("#po-member-since")
    poIcoCopy         = document.querySelector("#po-ico-copy")
    poIcoCheck        = document.querySelector("#po-ico-check")
    friendListContent = document.querySelector("#po-friend-list-content")
    friendListClose   = document.querySelector("#po-friend-list-close")
    overlayAddBaseBtn = document.querySelector("#po-overlay-add-base-button")
    overlayAddClanBtn = document.querySelector("#po-overlay-add-clan-button")
    inputBaseTag      = document.querySelector("#po-input-base-tag")
    inputBaseToken    = document.querySelector("#po-input-base-token")
    inputClanTag      = document.querySelector("#po-input-clan-tag")
    friendListTitle   = document.querySelector("#po-friend-list-title")
    poAddText         = document.querySelector("#po-add-text")
    poGroupList       = document.querySelector("#po-group-list")
    poLogoutBtn      = document.querySelector("#po-logout-btn")
    poSettings       = document.querySelector(".po-settings")
}

function profileInit(){
    openProfileBtn.onclick = () => {
        if (cachedProfile) {
            openProfile(cachedProfile.name, "#" + cachedProfile.code, cachedProfile.created_at.split("T")[0])
        } else if (localStorage.getItem("id") === null) {
            if (window.location.pathname.includes("index.html")) {
                window.location.href = "subpages/login.html"
            } else {
                window.location.href = "./login.html"
            }
        } else {
            isUserLoggedIn()
        }
    }

    profile.onclick = (e) => { poBackdrop(e) }
    closeProfileBtn.onclick = () => { closeProfile() }
    userCode.onclick = () => { poCopy() }
    profileTabs.forEach(tab => { tab.onclick = (e) => { poTab(e.target) } })
    friendListClose.onclick = () => { friendList.classList.add('hidden') }

    friendRequestBtn.onclick = () => {
        friendListTitle.textContent = "Friend Requests"
        emptyFriendRequest.textContent = "No requests"
        friendList.classList.remove('hidden')
        getFriendRequests(localStorage.getItem("id"))
            .then(res => {
                friendListContent.querySelectorAll(".po-base-item").forEach(item => item.remove())
                if (res.length === 0) {
                    emptyFriendRequest.classList.remove('hidden')
                    return
                }
                emptyFriendRequest.classList.add('hidden')
                res.forEach(friend => { createFriendRequestCard(friend.user_b) })
            })
    }

    friendPendingBtn.onclick = () => {
        friendListTitle.textContent = "Pending"
        emptyFriendRequest.textContent = "No pending requests"
        friendList.classList.remove('hidden')
        getPendingFriendRequests(localStorage.getItem("id"))
            .then(res => {
                friendListContent.querySelectorAll(".po-base-item").forEach(item => item.remove())
                if (res.length === 0) {
                    emptyFriendRequest.classList.remove('hidden')
                    return
                }
                emptyFriendRequest.classList.add('hidden')
                res.forEach(friend => { createFriendPendingCard(friend.user_b) })
            })
    }

    poLogoutBtn.onclick = () => {
        localStorage.clear()
        if (window.location.pathname.includes("index.html")) {
            window.location.href = "#"
        }else{
            window.location.href = "../index.html"
        }
    }

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return
        if (!addBase.classList.contains('hidden') ||
            !addClan.classList.contains('hidden') ||
            !friendList.classList.contains('hidden')) {
            addBase.classList.add('hidden')
            addClan.classList.add('hidden')
            friendList.classList.add('hidden')
            return
        }
        closeProfile()
    })
}

function preloadProfileData() {
    if (localStorage.getItem("id") === null) return
    checkUserId(localStorage.getItem("id"))
        .then(res => {
            cachedProfile = res
            loadBases(res.accounts)
            loadFriends()
            loadClans()
        })
}

function openProfile(username, code, memberSince) {
    poUsername.textContent = username || 'User'
    poCode.textContent = code || ''
    poMemberSince.textContent = memberSince ? 'Lid sinds ' + memberSince : '/'
    profile.classList.add('po-open')
    document.body.style.overflow = 'hidden'
    poTab(activeTab)
}

function closeProfile() {
    profile.classList.remove('po-open')
    document.body.style.overflow = ''
    document.querySelectorAll(".po-card-base, .po-card-friend, .po-card-clan").forEach(el => el.remove())
    clansLoaded = false
}

function poBackdrop(e) {
    if (e.target.id === 'profile-overlay') closeProfile()
}

function poTab(btn) {
    profileTabs.forEach(t => t.classList.remove('po-tab-active'))
    btn.classList.add('po-tab-active')
    activeTab = btn

    controller.abort()
    controller = new AbortController()

    const isBase     = btn.id === 'po-tab-bases'
    const isFriend   = btn.id === 'po-tab-friends'
    const isClan     = btn.id === 'po-tab-clans'
    const isSettings = btn.id === 'po-tab-settings'

    document.querySelectorAll(".po-card-base")
        .forEach(t => t.classList.toggle('hidden', !isBase))

    document.querySelectorAll(".po-card-friend")
        .forEach(t => t.classList.toggle('hidden', !isFriend))

    document.querySelectorAll(".po-card-clan")
        .forEach(t => t.classList.toggle('hidden', !isClan))

    poSettings.classList.toggle('hidden', !isSettings)

    friendRequestBtn.classList.toggle('hidden', !isFriend)
    friendPendingBtn.classList.toggle('hidden', !isFriend)

    const baseCards   = document.querySelectorAll(".po-card-base")
    const friendCards = document.querySelectorAll(".po-card-friend")
    const clanCards   = document.querySelectorAll(".po-card-clan")

    if (isSettings) {
        emptyLabel.classList.add('hidden')
        addBtn.classList.add('hidden')
        addBtn.onclick = null
        return
    }

    const cards =
        isBase ? baseCards :
            isFriend ? friendCards :
                isClan ? clanCards :
                    null

    const emptyText =
        isBase ? "No Bases" :
            isFriend ? "No Friends" :
                isClan ? "No Clans" :
                    "Empty"

    const addLabel =
        isBase ? "ADD BASE" :
            isFriend ? "ADD FRIEND" :
                isClan ? "ADD CLAN" :
                    "ADD"

    if (cards && cards.length > 0) {
        emptyLabel.classList.add('hidden')
    } else {
        emptyLabel.textContent = emptyText
        emptyLabel.classList.remove('hidden')
    }

    poAddText.textContent = addLabel
    addBtn.classList.remove('hidden')

    if (isBase) {addBtn.onclick = () => {openAddOverlay(addBase, handleAddBase)}}
    if (isFriend) {addBtn.onclick = () => {openAddOverlay(addBase, handleAddFriend)}}
    if (isClan) {addBtn.onclick = () => {openAddOverlay(addClan, handleAddClan)}}
}

function openAddOverlay(overlay, onConfirm) {
    overlay.classList.remove('hidden')
    const confirmBtn = overlay === addBase ? overlayAddBaseBtn : overlayAddClanBtn
    confirmBtn.onclick = () => {
        onConfirm()
        overlay.classList.add('hidden')
    }
}

function handleAddBase() {
    const playerId    = inputBaseTag.value
    const playerToken = inputBaseToken.value
    postPlayerVerifyTokenRequest(playerId, playerToken).then(confirmation => {
        if (confirmation.status === "ok") {
            getPlayerWithBattleData(playerId).then(playerData => {
                createBaseCard(playerData[0])
                addBaseToUser(localStorage.getItem("id"), playerData[0])
                    .then(confirm => { console.log(confirm) })
            })
        }
    })
}

function handleAddFriend() {
    const friendCode = inputClanTag.value.split("#")[1]
    addFriend(localStorage.getItem("id"), friendCode)
        .then(confirm => { console.log(confirm) })
}

function handleAddClan() {}

function poCopy() {
    navigator.clipboard.writeText(poCode.textContent).catch(() => {})
    poIcoCopy.classList.add('po-hidden')
    poIcoCheck.classList.remove('po-hidden')
    clearTimeout(poCopyTimer)
    poCopyTimer = setTimeout(() => {
        poIcoCopy.classList.remove('po-hidden')
        poIcoCheck.classList.add('po-hidden')
    }, 1800)
}

function loadBases(baseArray){
    if (document.querySelectorAll(".po-card-base").length > 0) return
    if (baseArray.length === 0) return
    emptyLabel.classList.add('hidden')
    baseArray.forEach(element => { createBaseCard(element) })
}

function loadFriends(){
    if (document.querySelectorAll(".po-card-friend").length > 0) return
    getFriends(localStorage.getItem("id"))
        .then(res => {
            if (res.length === 0) return
            emptyLabel.classList.add('hidden')
            res.forEach(friend => { createFriendCard(friend.user_b) })
        })
}

function loadClans() {
    if (clansLoaded) return
    clansLoaded = true

    getGroupsOfUser(localStorage.getItem("id")).then(groups => {
        if (groups.length === 0) return
        groups.forEach(group => {
            getGroupInfo(group.group_id).then(groupInfo => {
                const clanTemplate = document.querySelector("#po-groups-item-template").content.cloneNode(true)
                clanTemplate.querySelector(".po-base-name").textContent = groupInfo[0].name
                clanTemplate.querySelector(".po-base-info").textContent = groupInfo[0].code
                const badge = clanTemplate.querySelector(".groups-role-badge")
                if (groupInfo[0].owner_id === localStorage.getItem("id")) {
                    badge.textContent = "Leader"
                    badge.classList.add("leader")
                } else if (groupInfo[0].co_leader_id === localStorage.getItem("id")) {
                    badge.textContent = "Co-Leader"
                    badge.classList.add("co-leader")
                }
                const item = clanTemplate.querySelector(".po-card-clan")
                item.classList.add('hidden')
                document.querySelector(".po-panel-content").appendChild(clanTemplate)
                if (document.querySelector('#po-tab-clans')?.classList.contains('po-tab-active')) {
                    item.classList.remove('hidden')
                    emptyLabel.classList.add('hidden')
                }
            })
        })
    })
}

function isUserLoggedIn() {
    if (localStorage.getItem("id") !== null) {
        checkUserId(localStorage.getItem("id"))
            .then(res => {
                cachedProfile = res
                openProfile(res.name, "#" + res.code, res.created_at.split("T")[0])
                loadBases(res.accounts)
                loadFriends()
                loadClans()
            })
    } else {
        if (window.location.pathname.includes("index.html")) {
            window.location.href = "subpages/login.html"
        }else{
            window.location.href = "./login.html"
        }
    }
}