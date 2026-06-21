import { initI18n, t } from '../i18n/i18n.js';
import { getClanInfoRequest } from "../API/API-Clan.js";
import { createGroupCard } from "../templates/GroupTemplates.js";
import { profileHTML } from "../profile/profile_popup.js";
import { addGroupClan, createGroup, getGroupsOfUser, joinGroup, leaveGroup } from "../Supabase/Supabase-Group.js";
import { getCurrentUserId } from "../utils/user.js";
import { withGlobalLoading } from "../utils/loading-state.js";
import { initCopyFeedback } from "../utils/copy-feedback.js";
import { initGroupsAdminPanel } from "../groups/groups-admin-panel.js";
import { initGroupsTooltips, updateCollapseTooltip } from "../groups/groups-tooltips.js";
import { badgeLabelKey, badgeSvg, GROUP_BADGES } from "../groups/groups-badges.js";
import { initGroupPolls } from "../groups/groups-polls.js";

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
const groupsBadgeOptions = document.querySelector('#groups-badge-options');
const groupsDetailCheckmark = document.querySelector("#groups-detail-checkmark");
const groupsDetailCopy    = document.querySelector("#groups-detail-copy");
const groupOverlayLeave   = document.querySelector("#groups-overlay-leave");
const groupsLeaveBtn      = document.querySelector('#groups-leave-btn');
const groupsLeaveCancelBtn = document.querySelector('#groups-leave-cancel-btn');
const groupsLeaveConfirmBtn = document.querySelector('#groups-leave-confirm-btn');
const groupsSettingsBtn   = document.querySelector('#groups-settings-btn');
const groupsAdminOverlay = document.querySelector('#groups-admin-overlay');
let adminPanel;
let selectedBadge = 'shield';
const OPEN_GROUP_STORAGE_KEY = 'clashtoolsOpenGroupId';

function init() {
    initI18n();
    sideBarToggle();
    initBadgePicker();
    groupsNewBtn.onclick = () => { newGroupOverlay(); };
    reloadGroups();
    profileHTML();
    copyCodeInit();
    leaveGroupFun();
    adminPanel = initGroupsAdminPanel(emptyGroupMessage);
    initGroupPolls(emptyGroupMessage);
    initGroupsTooltips({ collapseBtn: groupsCollapseBtn, main: groupsMain });
    escPopupClose();
    overlayBackdropClose();
}

function requireLoggedIn() {
    const userId = getCurrentUserId();
    if (userId) return userId;
    resetGroupDetail();
    groupsList.replaceChildren(emptyGroupMessage(t('groups.login')));
    return null;
}

function newGroupOverlay() {
    if (!requireLoggedIn()) return;
    groupsOverlayNew.classList.remove('hidden');
    groupsOverlayCreateBtn.onclick = () => {
        const name = groupsInputName.value.trim();
        createNewGroup(name, "name", selectedBadge);
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
            createNewGroup(name, "name", selectedBadge);
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
            createNewGroup(name, "clanTag", selectedBadge);
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

    groupsList.replaceChildren(emptyGroupMessage(t('groups.loading')));
    withGlobalLoading(() => getGroupsOfUser(userId).then(data => {
        groupsList.replaceChildren();
        if (!Array.isArray(data) || data.length === 0) {
            groupsList.appendChild(emptyGroupMessage(t('groups.none')));
            resetGroupDetail();
            return;
        }
        const requestedGroupId = sessionStorage.getItem(OPEN_GROUP_STORAGE_KEY);
        return createGroupCard(data, { autoOpenGroupId: requestedGroupId }).then(opened => {
            if (requestedGroupId) {
                sessionStorage.removeItem(OPEN_GROUP_STORAGE_KEY);
                if (!opened) resetGroupDetail();
            }
        });
    }).catch(error => {
        console.error(error);
        groupsList.replaceChildren(emptyGroupMessage(t('groups.loadError')));
    }), t('groups.loading'));
}

function createNewGroup(value, option, badge = 'shield') {
    const userId = requireLoggedIn();
    if (!userId || !value) return;

    if (option === "name") {
        withGlobalLoading(() => createGroup(value, userId, badge).then(() => {
            groupsInputName.value = '';
            reloadGroups();
        }).catch(error => console.error(error)), t('groups.loading'));
    } else if (option === "clanTag") {
        withGlobalLoading(() => getClanInfoRequest(value).then(clanInfo => {
            const clanTag = normalizeClanTag(clanInfo?.tag || value);
            const clanName = clanInfo?.name || clanTag;
            const officialBadgeUrl = clanBadgeUrl(clanInfo);
            return createGroup(clanName, userId, badge, officialBadgeUrl).then(createdGroup => {
                const groupId = Array.isArray(createdGroup) ? createdGroup[0]?.id : createdGroup?.id;
                if (!groupId) throw new Error('Groep aangemaakt, maar group id ontbreekt');
                return addGroupClan(groupId, userId, {
                    tag: clanTag,
                    name: clanName,
                    badgeUrl: officialBadgeUrl
                }).catch(error => {
                    console.error(error);
                    throw new Error('GROUP_CLAN_LINK_FAILED');
                });
            }).then(() => {
                groupsInputClanTag.value = '';
                groupsClanHint.textContent = '';
                reloadGroups();
            });
        }).catch(error => {
            console.error(error);
            groupsClanHint.textContent = error?.message === 'GROUP_CLAN_LINK_FAILED'
                ? t('groups.clanLinkError')
                : t('groups.clanNotFound');
        }), t('groups.loading'));
    }
}

function normalizeClanTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

function clanBadgeUrl(clanInfo) {
    return clanInfo?.badgeUrls?.medium || clanInfo?.badgeUrls?.small || clanInfo?.badgeUrls?.large || '';
}

function initBadgePicker() {
    if (!groupsBadgeOptions) return;
    groupsBadgeOptions.replaceChildren();
    GROUP_BADGES.forEach(badge => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'groups-badge-option';
        button.dataset.badge = badge;
        button.title = t(badgeLabelKey(badge));
        button.innerHTML = badgeSvg(badge);
        button.addEventListener('click', () => selectBadge(badge));
        groupsBadgeOptions.appendChild(button);
    });
    selectBadge(selectedBadge);
}

function selectBadge(badge) {
    selectedBadge = badge;
    groupsBadgeOptions?.querySelectorAll('.groups-badge-option')
        .forEach(button => button.classList.toggle('active', button.dataset.badge === selectedBadge));
}

function joinGroupFun(code) {
    const userId = requireLoggedIn();
    if (!userId || !code) return;
    withGlobalLoading(() => joinGroup(userId, code).then(() => {
        groupsInputJoinCode.value = '';
        reloadGroups();
    }).catch(error => console.error(error)), t('groups.loading'));
}

function leaveGroupFun() {
    groupsLeaveBtn.onclick = () => { groupOverlayLeave.classList.remove('hidden'); };
    groupsLeaveCancelBtn.onclick = () => { groupOverlayLeave.classList.add('hidden'); };
    groupsLeaveConfirmBtn.onclick = () => {
        const userId = requireLoggedIn();
        const code = document.querySelector('#groups-detail-code-text')?.textContent?.trim();
        groupOverlayLeave.classList.add('hidden');
        if (!userId || !code) return;
        withGlobalLoading(() => leaveGroup(userId, code).then(() => {
            resetGroupDetail();
            reloadGroups();
        }).catch(error => console.error(error)), t('groups.loading'));
    };
}

function resetGroupDetail() {
    groupsDetailEmpty.classList.remove('hidden');
    groupsDetailContent.classList.add('hidden');
    groupsSettingsBtn?.classList.add('hidden');
    groupsAdminOverlay?.classList.add('hidden');
    const memberList = document.querySelector('#groups-member-list');
    if (memberList) memberList.replaceChildren(emptyGroupMessage(t('groups.noMembers')));
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
        updateCollapseTooltip(groupsCollapseBtn, groupsMain);
    });
}

function copyCodeInit() {
    initCopyFeedback({
        trigger: groupsDetailCode,
        copyIcon: groupsDetailCopy,
        checkIcon: groupsDetailCheckmark,
        getText: () => groupsDetailCode.querySelector('span')?.textContent?.trim()
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
            return;
        }
        adminPanel?.closeAll();
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
