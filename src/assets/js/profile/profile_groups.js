import { getGroupsOfUser, getGroupInfo } from "../Supabase/Supabase-Group.js";
import { getCurrentUserId } from "../utils/user.js";
import { applyRoleBadge, getCurrentUserRole } from "../groups/groups-roles.js";
import { renderBadge } from "../groups/groups-badges.js";
import { t } from "../i18n/i18n.js";

let clansLoaded = false;
const OPEN_GROUP_STORAGE_KEY = 'clashtoolsOpenGroupId';

export function resetClansLoaded() {
    clansLoaded = false;
}

export function renderGroups(groups, emptyLabel, force = false) {
    if (force) document.querySelectorAll(".po-card-clan").forEach(el => el.remove());
    if (!Array.isArray(groups) || groups.length === 0) return;
    Promise.all(groups.map(group => getGroupInfo(group.group_id)))
        .then(groupInfos => {
            groupInfos.forEach((groupInfo, index) => {
                const clanTemplate = document.querySelector("#po-groups-item-template").content.cloneNode(true);
                if (!Array.isArray(groupInfo) || !groupInfo[0]) return;
                const group = groupInfo[0];
                const hasActivePoll = groupHasActivePoll(group);
                clanTemplate.querySelector(".po-base-name").textContent = group.name;
                clanTemplate.querySelector(".po-base-info").textContent = group.code;
                clanTemplate.querySelector(".po-group-poll")?.classList.toggle('hidden', !hasActivePoll);
                renderBadge(clanTemplate.querySelector(".po-base-icon"), group.badge, group.badge_url);
                const badge = clanTemplate.querySelector(".groups-role-badge");
                applyRoleBadge(badge, getCurrentUserRole(group, [], getCurrentUserId(), groups[index]), t);
                const item = clanTemplate.querySelector(".po-card-clan");
                item.dataset.groupId = group.id;
                item.setAttribute('role', 'button');
                item.tabIndex = 0;
                item.title = t('groups.openGroup');
                item.setAttribute('aria-label', `${t('groups.openGroup')}: ${group.name}`);
                item.addEventListener('click', event => {
                    if (event.target.closest('button, a, input, select, textarea')) return;
                    openGroupPage(group.id);
                });
                item.addEventListener('keydown', event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    openGroupPage(group.id);
                });
                item.classList.add('hidden');
                document.querySelector(".po-panel-content").appendChild(clanTemplate);
                if (document.querySelector('#po-tab-clans')?.classList.contains('po-tab-active')) {
                    item.classList.remove('hidden');
                    emptyLabel.classList.add('hidden');
                }
            });
        });
}

function groupHasActivePoll(group) {
    const polls = parsePolls(group.polls);
    return polls.some(poll => poll.type === 'cwl_availability' && poll.status === 'open');
}

function openGroupPage(groupId) {
    if (!groupId) return;
    sessionStorage.setItem(OPEN_GROUP_STORAGE_KEY, groupId);
    document.querySelector('#profile-overlay')?.classList.remove('po-open');
    document.body.style.overflow = '';
    window.location.href = getGroupsPagePath();
}

function getGroupsPagePath() {
    return '/app/clan-management';
}

function parsePolls(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'string') return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function loadClans(emptyLabel) {
    if (clansLoaded) return;
    clansLoaded = true;
    const userId = getCurrentUserId();
    if (!userId) return;
    getGroupsOfUser(userId).then(groups => renderGroups(groups, emptyLabel));
}
