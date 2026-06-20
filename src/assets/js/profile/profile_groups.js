import { getGroupsOfUser, getGroupInfo } from "../Supabase/Supabase-Group.js";
import { getCurrentUserId } from "../utils/user.js";
import { applyRoleBadge, getCurrentUserRole } from "../groups/groups-roles.js";
import { renderBadge } from "../groups/groups-badges.js";
import { t } from "../i18n/i18n.js";

let clansLoaded = false;

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
                clanTemplate.querySelector(".po-base-name").textContent = groupInfo[0].name;
                clanTemplate.querySelector(".po-base-info").textContent = groupInfoText(groupInfo[0]);
                renderBadge(clanTemplate.querySelector(".po-base-icon"), groupInfo[0].badge, groupInfo[0].badge_url);
                const badge = clanTemplate.querySelector(".groups-role-badge");
                applyRoleBadge(badge, getCurrentUserRole(groupInfo[0], [], getCurrentUserId(), groups[index]), t);
                const item = clanTemplate.querySelector(".po-card-clan");
                item.classList.add('hidden');
                document.querySelector(".po-panel-content").appendChild(clanTemplate);
                if (document.querySelector('#po-tab-clans')?.classList.contains('po-tab-active')) {
                    item.classList.remove('hidden');
                    emptyLabel.classList.add('hidden');
                }
            });
        });
}

function groupInfoText(group) {
    const polls = parsePolls(group.polls);
    const hasActivePoll = polls.some(poll => poll.type === 'cwl_availability' && poll.status === 'open');
    return hasActivePoll ? `${group.code} - ${t('groups.pollActive')}` : group.code;
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
