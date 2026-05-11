import { databaseRequestWithBody} from "./API/API-Communication.js";
import { getClanInfoRequest } from "./API/API-Clan.js";
import * as conf from "./Data/config.js"
import { createGroupCard } from "./Templates.js";
import { profileHTML } from "./profile_popup.js"

const groupsMain         = document.querySelector('#groups-main');
const groupsSidebar      = document.querySelector('#groups-sidebar');
const groupsNewBtn       = document.querySelector('#groups-new-btn');
const groupsList         = document.querySelector('#groups-list');
const groupsCollapseBtn  = document.querySelector('#groups-collapse-btn');
const groupsCollapseIcon = document.querySelector('#groups-collapse-icon');
const groupsDetailEmpty  = document.querySelector('#groups-detail-empty');
const groupsDetailContent= document.querySelector('#groups-detail-content');
const groupsDetailLogo   = document.querySelector('#groups-detail-logo');
const groupsDetailName   = document.querySelector('#groups-detail-name');
const groupsDetailCount  = document.querySelector('#groups-detail-count');
const groupsDetailCode   = document.querySelector('#groups-detail-code');
const groupsDetailRole   = document.querySelector('#groups-detail-role');
const groupsDetailSince  = document.querySelector('#groups-detail-since');
const groupsPollBtn      = document.querySelector('#groups-poll-btn');
const groupsInviteBtn    = document.querySelector('#groups-invite-btn');
const groupsSettingsBtn  = document.querySelector('#groups-settings-btn');
const groupsLeaveBtn     = document.querySelector('#groups-leave-btn');
const groupsMembersTitle = document.querySelector('#groups-members-title');
const groupsMemberList   = document.querySelector('#groups-member-list');
const groupsOverlayNew   = document.querySelector('#groups-overlay-new');
const groupsTabCreate    = document.querySelector('#groups-tab-create');
const groupsTabJoin      = document.querySelector('#groups-tab-join');
const groupsPanelCreate  = document.querySelector('#groups-panel-create');
const groupsPanelJoin    = document.querySelector('#groups-panel-join');
const groupsCreateOptName= document.querySelector('#groups-create-opt-name');
const groupsCreateOptClan= document.querySelector('#groups-create-opt-clan');
const groupsCreateByName = document.querySelector('#groups-create-by-name');
const groupsCreateByClan = document.querySelector('#groups-create-by-clan');
const groupsInputName    = document.querySelector('#groups-input-name');
const groupsInputClanTag = document.querySelector('#groups-input-clan-tag');
const groupsClanHint     = document.querySelector('#groups-clan-hint');
const groupsOverlayCreateBtn= document.querySelector('#groups-overlay-create-btn');
const groupsInputJoinCode= document.querySelector('#groups-input-join-code');
const groupsOverlayJoinBtn= document.querySelector('#groups-overlay-join-btn');
const groupsItemTemplate = document.querySelector('#groups-item-template');
const groupsMemberTemplate = document.querySelector('#groups-member-template');
const groupsDetailCheckmark = document.querySelector("#groups-detail-checkmark");
const groupsDetailCopy   = document.querySelector("#groups-detail-copy");
const groupOverlayLeave  = document.querySelector("#groups-overlay-leave")
const groupsLeaveCancelBtn= document.querySelector('#groups-leave-cancel-btn');
const groupsLeaveConfirmBtn = document.querySelector('#groups-leave-confirm-btn')
let timer

function init(){
    sideBarToggle()
    groupsNewBtn.onclick = () => {newGroupOverlay()}
    initGroups()
    profileHTML()
    copyCodeInit()
    leaveGroup()
    escPopupClose()
    overlayBackdropClose()
}

function newGroupOverlay(){
    groupsOverlayNew.classList.remove('hidden');
    groupsOverlayCreateBtn.onclick = () => {
        const name = groupsInputName.value
        createNewGroup(name, "name")
        groupsOverlayNew.classList.add('hidden');
    }

    groupsOverlayJoinBtn.onclick = () => {
        const code = groupsInputJoinCode.value
        joinGroup(code);
        groupsOverlayNew.classList.add('hidden');
    }

    groupsTabCreate.onclick = () => {
        groupsPanelCreate.classList.remove('hidden')
        groupsPanelJoin.classList.add('hidden')
        groupsTabJoin.classList.remove('groups-overlay-tab-active')
        groupsTabCreate.classList.add('groups-overlay-tab-active')
    }

    groupsCreateOptName.onclick = () => {
        groupsCreateOptName.classList.add('groups-create-option-active')
        groupsCreateOptClan.classList.remove('groups-create-option-active')
        groupsCreateByName.classList.remove('hidden')
        groupsCreateByClan.classList.add('hidden')
        groupsOverlayCreateBtn.onclick = () => {
            const name = groupsInputName.value
            createNewGroup(name, "name")
            groupsOverlayNew.classList.add('hidden');
        }
    }

    groupsCreateOptClan.onclick = () => {
        groupsCreateOptClan.classList.add('groups-create-option-active')
        groupsCreateOptName.classList.remove('groups-create-option-active')
        groupsCreateByName.classList.add('hidden')
        groupsCreateByClan.classList.remove('hidden')
        groupsOverlayCreateBtn.onclick = () => {
            const name = groupsInputClanTag.value
            createNewGroup(name, "clanTag")
            groupsOverlayNew.classList.add('hidden');
        }
    }

    groupsTabJoin.onclick = () => {
        groupsPanelCreate.classList.add('hidden')
        groupsPanelJoin.classList.remove('hidden')
        groupsTabJoin.classList.add('groups-overlay-tab-active')
        groupsTabCreate.classList.remove('groups-overlay-tab-active')
    }
}

function initGroups(){
    const path = conf._BASE_URL + conf._EXT_SUPA_GROUP_MEMBER
    const data = {id: localStorage.getItem("id")}
    databaseRequestWithBody(path, data).then(data => {createGroupCard(data)})
}

function createNewGroup(value, option){
    if(option === "name"){
        const data = {name: value, ownerId: localStorage.getItem("id")}
        databaseRequestWithBody(conf._BASE_URL + conf._EXT_SUPA_GROUP_MAKE, data).then(data => console.log(data))
    }else if(option === "clanTag"){
        getClanInfoRequest(value)
            .then(clanInfo => {
                const data = {name: clanInfo.name, ownerId: localStorage.getItem("id")}
                databaseRequestWithBody(conf._BASE_URL + conf._EXT_SUPA_GROUP_MAKE, data).then(data => console.log(data))
            })
    }
}

function joinGroup(code){
    const path = conf._BASE_URL + conf._EXT_SUPA_GROUP_JOIN
    const data = {id: localStorage.getItem("id"), code: code}
    databaseRequestWithBody(path, data).then(data => console.log(data))
}

function leaveGroup(){
    groupsLeaveBtn.onclick = () => {groupOverlayLeave.classList.remove('hidden')}
    groupsLeaveCancelBtn.onclick = () => {groupOverlayLeave.classList.add('hidden')}
    groupsLeaveConfirmBtn.onclick = () => {
        groupOverlayLeave.classList.add('hidden')
        const path = conf._BASE_URL + conf._EXT_SUPA_GROUP_LEAVE
        const data = {id: localStorage.getItem("id"), code: groupsDetailCode.textContent}
        databaseRequestWithBody(path, data).then(data => console.log(data))
    }
}

function sideBarToggle(){
    groupsCollapseBtn.addEventListener('click', () => {
        groupsMain.classList.toggle('sidebar-collapsed');

        const collapsed = groupsMain.classList.contains('sidebar-collapsed');
        groupsCollapseBtn.setAttribute('aria-label', collapsed ? 'Sidebar uitklappen' : 'Sidebar inklappen');
        groupsCollapseBtn.setAttribute('title',      collapsed ? 'Uitklappen'         : 'Inklappen');
    });
}

function copyCodeInit(){
    groupsDetailCode.addEventListener('click', () => {
        const code = groupsDetailCode.querySelector('span').textContent;
        navigator.clipboard.writeText(code).then(() => {
            groupsDetailCheckmark.classList.remove('hidden');
            groupsDetailCopy.classList.add('hidden');
            clearTimeout(timer)
            timer = setTimeout(() => {
                groupsDetailCheckmark.classList.add('hidden')
                groupsDetailCopy.classList.remove('hidden')
            }, 1800)
        });
    });
}

function escPopupClose(){
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return

        if (!groupsOverlayNew.classList.contains('hidden')) {
            groupsOverlayNew.classList.add('hidden')
            return
        }

        if (!groupOverlayLeave.classList.contains('hidden')) {
            groupOverlayLeave.classList.add('hidden')
            return
        }
    })
}

function overlayBackdropClose(){
    groupsOverlayNew.onclick = (e) => {
        if (e.target === groupsOverlayNew) {
            groupsOverlayNew.classList.add('hidden')
        }
    }

    groupOverlayLeave.onclick = (e) => {
        if (e.target === groupOverlayLeave) {
            groupOverlayLeave.classList.add('hidden')
        }
    }
}

init()