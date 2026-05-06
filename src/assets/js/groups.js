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

// sidebar toggle
groupsCollapseBtn.addEventListener('click', () => {
    groupsMain.classList.toggle('sidebar-collapsed');

    const collapsed = groupsMain.classList.contains('sidebar-collapsed');
    groupsCollapseBtn.setAttribute('aria-label', collapsed ? 'Sidebar uitklappen' : 'Sidebar inklappen');
    groupsCollapseBtn.setAttribute('title',      collapsed ? 'Uitklappen'         : 'Inklappen');
});