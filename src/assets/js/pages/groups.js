import { getClanInfoRequest } from "../API/API-Clan.js";
import { createGroupCard } from "../templates/GroupTemplates.js";
import { profileHTML } from "../profile/profile_popup.js";
import { createGroup, getGroupsOfUser, joinGroup, leaveGroup } from "../Supabase/Supabase-Group.js";
import { getCurrentUserId } from "../utils/user.js";

const groupsMain          = document.querySelector('#groups-main');
const groupsNewBtn        = document.querySelector('#groups-new-btn');
const groupsList          = document.querySelector('#groups-list');
const groupsCollapseBtn   = document.querySelector('#groups-collapse-btn');
const groupsDetailEmpty   = document.querySelector('#groups-detail-empty');
const groupsDetailContent = document.querySelector('#groups-detail-content');
const groupsDetailCode    = document.querySelector('#groups-detail-code');
const groupsOverlayNew    = document.querySelector('#groups-overlay-new');
const groupsTabCreate     = document.querySelector('#groups-tab-create');
const groupsTabJoin       = document.querySelector('#groups-tab-join');
const groupsPanelCreate   = document.querySelector('#groups-panel-create');
const groupsPanelJoin     = document.querySelector('#groups-panel-join');
const groupsCreateOptName = document.querySelector('#groups-create-opt-name');
const groupsCreateOptClan = document.querySelector('#groups-create-opt-clan');
const groupsCreateByName  = document.querySelector('#groups-create-by-name');
const groupsCreateByClan  = document.querySelector('#groups-create-by-clan');
const groupsInputName     = document.querySelector('#groups-input-name');
const groupsInputClanTag  = document.querySelector('#groups-input-clan-tag');
const groupsClanHint      = document.querySelector('#groups-clan-hint');
const groupsOverlayCreateBtn = document.querySelector('#groups-overlay-create-btn');
const groupsInputJoinCode = document.querySelector('#groups-input-join-code');
const groupsOverlayJoinBtn = document.querySelector('#groups-overlay-join-btn');
const groupsDetailCheckmark = document.querySelector("#groups-detail-checkmark");
const groupsDetailCopy    = document.querySelector("#groups-detail-copy");
const groupOverlayLeave   = document.querySelector("#groups-overlay-leave");
const groupsLeaveBtn      = document.querySelector('#groups-leave-btn');
const groupsLeaveCancelBtn = document.querySelector('#groups-leave-cancel-btn');
const groupsLeaveConfirmBtn = document.querySelector('#groups-leave-confirm-btn');
let timer;

function init() {
    sideBarToggle();
    groupsNewBtn.onclick = () => { newGroupOverlay(); };
    reloadGroups();
    profileHTML();
    copyCodeInit();
    leaveGroupFun();
    escPopupClose();
    overlayBackdropClose();
}

function requireLoggedIn() {
    const userId = getCurrentUserId();
    if (userId) return userId;
    resetGroupDetail();
    groupsList.replaceChildren(emptyGroupMessage('Log in om groepen te gebruiken'));
    return null;
}

function newGroupOverlay() {
    if (!requireLoggedIn()) return;
    groupsOverlayNew.classList.remove('hidden');
    groupsOverlayCreateBtn.onclick = () => {
        const name = groupsInputName.value.trim();
        createNewGroup(name, "name");
        groupsOverlayNew.classList.add('hidden');
    };

    groupsOverlayJoinBtn.onclick = () => {
        const code = groupsInputJoinCode.value.trim();
        joinGroupFun(code);
        groupsOverlayNew.classList.add('hidden');
    };

    groupsTabCreate.onclick = () => {
        groupsPanelCreate.classList.remove('hidden');
        groupsPanelJoin.classList.add('hidden');
        groupsTabJoin.classList.remove('groups-overlay-tab-active');
        groupsTabCreate.classList.add('groups-overlay-tab-active');
    };

    groupsCreateOptName.onclick = () => {
        groupsCreateOptName.classList.add('groups-create-option-active');
        groupsCreateOptClan.classList.remove('groups-create-option-active');
        groupsCreateByName.classList.remove('hidden');
        groupsCreateByClan.classList.add('hidden');
        groupsOverlayCreateBtn.onclick = () => {
            const name = groupsInputName.value.trim();
            createNewGroup(name, "name");
            groupsOverlayNew.classList.add('hidden');
        };
    };

    groupsCreateOptClan.onclick = () => {
        groupsCreateOptClan.classList.add('groups-create-option-active');
        groupsCreateOptName.classList.remove('groups-create-option-active');
        groupsCreateByName.classList.add('hidden');
        groupsCreateByClan.classList.remove('hidden');
        groupsOverlayCreateBtn.onclick = () => {
            const name = groupsInputClanTag.value.trim();
            createNewGroup(name, "clanTag");
            groupsOverlayNew.classList.add('hidden');
        };
    };

    groupsTabJoin.onclick = () => {
        groupsPanelCreate.classList.add('hidden');
        groupsPanelJoin.classList.remove('hidden');
        groupsTabJoin.classList.add('groups-overlay-tab-active');
        groupsTabCreate.classList.remove('groups-overlay-tab-active');
    };
}

function reloadGroups() {
    const userId = requireLoggedIn();
    if (!userId) return;

    groupsList.replaceChildren(emptyGroupMessage('Groepen laden...'));
    getGroupsOfUser(userId).then(data => {
        groupsList.replaceChildren();
        if (!Array.isArray(data) || data.length === 0) {
            groupsList.appendChild(emptyGroupMessage('Geen groepen'));
            resetGroupDetail();
            return;
        }
        createGroupCard(data);
    }).catch(error => {
        console.error(error);
        groupsList.replaceChildren(emptyGroupMessage('Groepen laden mislukt'));
    });
}

function createNewGroup(value, option) {
    const userId = requireLoggedIn();
    if (!userId || !value) return;

    if (option === "name") {
        createGroup(value, userId).then(() => {
            groupsInputName.value = '';
            reloadGroups();
        }).catch(error => console.error(error));
    } else if (option === "clanTag") {
        getClanInfoRequest(value).then(clanInfo => {
            createGroup(clanInfo.name, userId).then(() => {
                groupsInputClanTag.value = '';
                groupsClanHint.textContent = '';
                reloadGroups();
            });
        }).catch(error => {
            console.error(error);
            groupsClanHint.textContent = 'Clan niet gevonden';
        });
    }
}

function joinGroupFun(code) {
    const userId = requireLoggedIn();
    if (!userId || !code) return;
    joinGroup(userId, code).then(() => {
        groupsInputJoinCode.value = '';
        reloadGroups();
    }).catch(error => console.error(error));
}

function leaveGroupFun() {
    groupsLeaveBtn.onclick = () => { groupOverlayLeave.classList.remove('hidden'); };
    groupsLeaveCancelBtn.onclick = () => { groupOverlayLeave.classList.add('hidden'); };
    groupsLeaveConfirmBtn.onclick = () => {
        const userId = requireLoggedIn();
        const code = document.querySelector('#groups-detail-code-text')?.textContent?.trim();
        groupOverlayLeave.classList.add('hidden');
        if (!userId || !code) return;
        leaveGroup(userId, code).then(() => {
            resetGroupDetail();
            reloadGroups();
        }).catch(error => console.error(error));
    };
}

function resetGroupDetail() {
    groupsDetailEmpty.classList.remove('hidden');
    groupsDetailContent.classList.add('hidden');
    const memberList = document.querySelector('#groups-member-list');
    if (memberList) memberList.replaceChildren(emptyGroupMessage('Geen leden'));
}

function emptyGroupMessage(text) {
    const p = document.createElement('p');
    p.className = 'groups-empty';
    p.textContent = text;
    return p;
}

function sideBarToggle() {
    groupsCollapseBtn.addEventListener('click', () => {
        groupsMain.classList.toggle('sidebar-collapsed');
        const collapsed = groupsMain.classList.contains('sidebar-collapsed');
        groupsCollapseBtn.setAttribute('aria-label', collapsed ? 'Sidebar uitklappen' : 'Sidebar inklappen');
        groupsCollapseBtn.setAttribute('title', collapsed ? 'Uitklappen' : 'Inklappen');
    });
}

function copyCodeInit() {
    groupsDetailCode.addEventListener('click', () => {
        const code = groupsDetailCode.querySelector('span').textContent;
        navigator.clipboard.writeText(code).then(() => {
            groupsDetailCheckmark.classList.remove('hidden');
            groupsDetailCopy.classList.add('hidden');
            clearTimeout(timer);
            timer = setTimeout(() => {
                groupsDetailCheckmark.classList.add('hidden');
                groupsDetailCopy.classList.remove('hidden');
            }, 1800);
        });
    });
}

function escPopupClose() {
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!groupsOverlayNew.classList.contains('hidden')) {
            groupsOverlayNew.classList.add('hidden');
            return;
        }
        if (!groupOverlayLeave.classList.contains('hidden')) {
            groupOverlayLeave.classList.add('hidden');
        }
    });
}

function overlayBackdropClose() {
    groupsOverlayNew.onclick = (e) => {
        if (e.target === groupsOverlayNew) groupsOverlayNew.classList.add('hidden');
    };
    groupOverlayLeave.onclick = (e) => {
        if (e.target === groupOverlayLeave) groupOverlayLeave.classList.add('hidden');
    };
}

init();
