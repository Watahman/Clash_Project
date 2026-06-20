import { initI18n, t } from '../i18n/i18n.js';
import { getClanInfoRequest, getClanMembersRequest } from "../API/API-Clan.js";
import { createGroupCard } from "../templates/GroupTemplates.js";
import { profileHTML } from "../profile/profile_popup.js";
import {
    addGroupClan,
    createGroup,
    getGroupClans,
    getGroupsOfUser,
    joinGroup,
    leaveGroup,
    removeGroupClan
} from "../Supabase/Supabase-Group.js";
import { getUserInfo } from "../Supabase/Supabase-User.js";
import { getCurrentUserId } from "../utils/user.js";
import { withGlobalLoading } from "../utils/loading-state.js";

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
const groupsSettingsBtn   = document.querySelector('#groups-settings-btn');
const groupsAdminPanel    = document.querySelector('#groups-admin-panel');
const groupsAdminTitle    = document.querySelector('#groups-admin-title');
const groupsAdminClanTag  = document.querySelector('#groups-admin-clan-tag');
const groupsAdminAddClan  = document.querySelector('#groups-admin-add-clan');
const groupsAdminMessage  = document.querySelector('#groups-admin-message');
const groupsLinkedClans   = document.querySelector('#groups-linked-clans');
const groupsAdminScanUnlinked = document.querySelector('#groups-admin-scan-unlinked');
const groupsUnlinkedAccounts  = document.querySelector('#groups-unlinked-accounts');
let timer;
let activeGroup = null;
let activeGroupMembers = [];
let activeLinkedClans = [];
let activeGroupIsLeader = false;

function init() {
    initI18n();
    sideBarToggle();
    groupsNewBtn.onclick = () => { newGroupOverlay(); };
    reloadGroups();
    profileHTML();
    copyCodeInit();
    leaveGroupFun();
    adminPanelInit();
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

    groupsList.replaceChildren(emptyGroupMessage(t('groups.loading')));
    withGlobalLoading(() => getGroupsOfUser(userId).then(data => {
        groupsList.replaceChildren();
        if (!Array.isArray(data) || data.length === 0) {
            groupsList.appendChild(emptyGroupMessage(t('groups.none')));
            resetGroupDetail();
            return;
        }
        createGroupCard(data);
    }).catch(error => {
        console.error(error);
        groupsList.replaceChildren(emptyGroupMessage(t('groups.loadError')));
    }), t('groups.loading'));
}

function createNewGroup(value, option) {
    const userId = requireLoggedIn();
    if (!userId || !value) return;

    if (option === "name") {
        withGlobalLoading(() => createGroup(value, userId).then(() => {
            groupsInputName.value = '';
            reloadGroups();
        }).catch(error => console.error(error)), t('groups.loading'));
    } else if (option === "clanTag") {
        withGlobalLoading(() => getClanInfoRequest(value).then(clanInfo => {
            return createGroup(clanInfo.name, userId).then(() => {
                groupsInputClanTag.value = '';
                groupsClanHint.textContent = '';
                reloadGroups();
            });
        }).catch(error => {
            console.error(error);
            groupsClanHint.textContent = 'Clan niet gevonden';
        }), t('groups.loading'));
    }
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
    activeGroup = null;
    activeGroupMembers = [];
    activeLinkedClans = [];
    activeGroupIsLeader = false;
    groupsSettingsBtn?.classList.add('hidden');
    groupsAdminPanel?.classList.add('hidden');
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

function adminPanelInit() {
    window.addEventListener('clashtools:group-opened', event => {
        activeGroup = event.detail?.group || null;
        activeGroupMembers = Array.isArray(event.detail?.members) ? event.detail.members : [];
        activeGroupIsLeader = Boolean(event.detail?.isLeader);
        activeLinkedClans = [];
        groupsAdminPanel?.classList.add('hidden');
        clearAdminMessage();
        renderLinkedClans([]);
        renderUnlinkedPlaceholder(t('groups.scanFirst'));

        if (groupsAdminTitle && activeGroup) {
            groupsAdminTitle.textContent = `${t('groups.adminTitle')}: ${activeGroup.name}`;
        }

        if (activeGroupIsLeader) {
            loadLinkedClans();
        }
    });

    groupsSettingsBtn?.addEventListener('click', () => {
        if (!activeGroupIsLeader) return;
        groupsAdminPanel?.classList.toggle('hidden');
        if (!groupsAdminPanel?.classList.contains('hidden')) {
            loadLinkedClans();
        }
    });

    groupsAdminAddClan?.addEventListener('click', () => {
        addLinkedClan();
    });

    groupsAdminClanTag?.addEventListener('keydown', event => {
        if (event.key === 'Enter') addLinkedClan();
    });

    groupsAdminScanUnlinked?.addEventListener('click', () => {
        scanUnlinkedAccounts();
    });
}

function normalizeClanTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

function getClanBadgeUrl(clanInfo) {
    return clanInfo?.badgeUrls?.small || clanInfo?.badgeUrls?.medium || clanInfo?.badgeUrls?.large || '';
}

function clearAdminMessage() {
    if (!groupsAdminMessage) return;
    groupsAdminMessage.textContent = '';
    groupsAdminMessage.classList.remove('error', 'success');
}

function setAdminMessage(message, type = 'error') {
    if (!groupsAdminMessage) return;
    groupsAdminMessage.textContent = message;
    groupsAdminMessage.classList.toggle('error', type === 'error');
    groupsAdminMessage.classList.toggle('success', type === 'success');
}

function ensureLeaderContext() {
    const userId = requireLoggedIn();
    if (!userId || !activeGroup || !activeGroupIsLeader) {
        setAdminMessage(t('groups.ownerOnly'));
        return null;
    }
    return userId;
}

function loadLinkedClans() {
    const userId = ensureLeaderContext();
    if (!userId) return;

    withGlobalLoading(() => getGroupClans(activeGroup.id, userId).then(clans => {
        activeLinkedClans = Array.isArray(clans) ? clans : [];
        renderLinkedClans(activeLinkedClans);
    }).catch(error => {
        console.error(error);
        activeLinkedClans = [];
        renderLinkedClans([]);
        setAdminMessage(t('groups.linkedClansLoadError'));
    }), t('groups.loading'));
}

function addLinkedClan() {
    const userId = ensureLeaderContext();
    const tag = normalizeClanTag(groupsAdminClanTag?.value);
    if (!userId || !tag) {
        setAdminMessage(t('groups.enterClanTag'));
        return;
    }

    if (activeLinkedClans.some(clan => normalizeClanTag(clan.clan_tag) === tag)) {
        setAdminMessage(t('groups.clanAlreadyLinked'));
        return;
    }

    withGlobalLoading(() => getClanInfoRequest(tag).then(clanInfo => {
        return addGroupClan(activeGroup.id, userId, {
            tag: normalizeClanTag(clanInfo?.tag || tag),
            name: clanInfo?.name || tag,
            badgeUrl: getClanBadgeUrl(clanInfo)
        });
    }).then(() => {
        if (groupsAdminClanTag) groupsAdminClanTag.value = '';
        setAdminMessage(t('groups.clanLinked'), 'success');
        loadLinkedClans();
    }).catch(error => {
        console.error(error);
        setAdminMessage(t('groups.clanLinkError'));
    }), t('groups.loading'));
}

function removeLinkedClan(clanTag) {
    const userId = ensureLeaderContext();
    const tag = normalizeClanTag(clanTag);
    if (!userId || !tag) return;

    withGlobalLoading(() => removeGroupClan(activeGroup.id, userId, tag).then(() => {
        activeLinkedClans = activeLinkedClans.filter(clan => normalizeClanTag(clan.clan_tag) !== tag);
        renderLinkedClans(activeLinkedClans);
        renderUnlinkedPlaceholder(t('groups.scanFirst'));
        setAdminMessage(t('groups.clanRemoved'), 'success');
    }).catch(error => {
        console.error(error);
        setAdminMessage(t('groups.clanRemoveError'));
    }), t('groups.loading'));
}

function renderLinkedClans(clans) {
    if (!groupsLinkedClans) return;
    groupsLinkedClans.replaceChildren();

    if (!Array.isArray(clans) || clans.length === 0) {
        groupsLinkedClans.appendChild(emptyGroupMessage(t('groups.noLinkedClans')));
        return;
    }

    clans.forEach(clan => {
        const item = document.createElement('div');
        item.className = 'groups-linked-clan';

        const badge = document.createElement('div');
        badge.className = 'groups-linked-clan-badge';
        if (clan.badge_url) {
            const img = document.createElement('img');
            img.src = clan.badge_url;
            img.alt = '';
            badge.appendChild(img);
        }

        const text = document.createElement('div');
        text.className = 'groups-linked-clan-text';
        const name = document.createElement('strong');
        name.textContent = clan.clan_name || clan.clan_tag;
        const tag = document.createElement('span');
        tag.textContent = normalizeClanTag(clan.clan_tag);
        text.append(name, tag);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-groups-icon groups-danger';
        removeBtn.title = t('groups.removeClan');
        removeBtn.textContent = 'x';
        removeBtn.addEventListener('click', () => removeLinkedClan(clan.clan_tag));

        item.append(badge, text, removeBtn);
        groupsLinkedClans.appendChild(item);
    });
}

function renderUnlinkedPlaceholder(message) {
    if (!groupsUnlinkedAccounts) return;
    groupsUnlinkedAccounts.replaceChildren(emptyGroupMessage(message));
}

function extractUserAccountTags(user) {
    const accounts = Array.isArray(user?.accounts) ? user.accounts : [];
    return accounts
        .map(account => normalizeClanTag(account?.tag || account?.playerTag || account?.accountTag || account?.clashTag))
        .filter(Boolean);
}

function getClanMemberItems(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.memberList)) return response.memberList;
    return [];
}

function scanUnlinkedAccounts() {
    const userId = ensureLeaderContext();
    if (!userId) return;
    if (!Array.isArray(activeLinkedClans) || activeLinkedClans.length === 0) {
        renderUnlinkedPlaceholder(t('groups.noLinkedClans'));
        return;
    }

    withGlobalLoading(async () => {
        const groupUsers = await Promise.all(activeGroupMembers.map(member => getUserInfo(member.user_id).catch(() => null)));
        const linkedTags = new Set();
        groupUsers.forEach(userData => {
            const user = Array.isArray(userData) ? userData[0] : userData;
            extractUserAccountTags(user).forEach(tag => linkedTags.add(tag));
        });

        const missingAccounts = [];
        for (const clan of activeLinkedClans) {
            const clanTag = normalizeClanTag(clan.clan_tag);
            const liveMembers = getClanMemberItems(await getClanMembersRequest(clanTag));
            liveMembers.forEach(member => {
                const memberTag = normalizeClanTag(member?.tag);
                if (!memberTag || linkedTags.has(memberTag)) return;
                missingAccounts.push({
                    name: member?.name || memberTag,
                    tag: memberTag,
                    townHall: member?.townHallLevel || member?.townHall || '',
                    clan: clan.clan_name || clanTag
                });
            });
        }

        renderUnlinkedAccounts(missingAccounts);
    }, t('groups.loading')).catch(error => {
        console.error(error);
        renderUnlinkedPlaceholder(t('groups.scanError'));
    });
}

function renderUnlinkedAccounts(accounts) {
    if (!groupsUnlinkedAccounts) return;
    groupsUnlinkedAccounts.replaceChildren();

    if (!Array.isArray(accounts) || accounts.length === 0) {
        groupsUnlinkedAccounts.appendChild(emptyGroupMessage(t('groups.noUnlinkedAccounts')));
        return;
    }

    accounts.forEach(account => {
        const item = document.createElement('div');
        item.className = 'groups-unlinked-account';

        const main = document.createElement('div');
        main.className = 'groups-unlinked-account-main';
        const name = document.createElement('strong');
        name.textContent = account.name;
        const meta = document.createElement('span');
        const thLabel = account.townHall ? `TH${account.townHall} - ` : '';
        meta.textContent = `${thLabel}${account.tag} - ${account.clan}`;
        main.append(name, meta);

        const status = document.createElement('span');
        status.className = 'groups-unlinked-status';
        status.textContent = t('groups.notLinkedToMember');

        item.append(main, status);
        groupsUnlinkedAccounts.appendChild(item);
    });
}

init();
