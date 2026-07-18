import { getClanInfoRequest, getClanMembersRequest } from "../API/API-Clan.js";
import { addGroupClan, getGroupClans, removeGroupClan } from "../Supabase/Supabase-Group.js";
import { t } from "../i18n/i18n.js";
import { withGlobalLoading } from "../utils/loading-state.js";
import { renderBadge } from "./groups-badges.js";

export function createClanAdmin(elements, getState, setMessage, emptyMessage) {
    let linkedClans = [];

    function normalizeTag(value) {
        const tag = String(value || '').trim().toUpperCase();
        if (!tag) return '';
        return tag.startsWith('#') ? tag : `#${tag}`;
    }

    function badgeUrl(clanInfo) {
        return clanInfo?.badgeUrls?.small || clanInfo?.badgeUrls?.medium || clanInfo?.badgeUrls?.large || '';
    }

    function setLinkedClans(clans, groupId = getState().group?.id) {
        linkedClans = Array.isArray(clans) ? clans : [];
        renderLinkedClans();
        if (groupId) {
            window.dispatchEvent(new CustomEvent('clashtools:group-clans-updated', {
                detail: { groupId, count: linkedClans.length }
            }));
        }
    }

    function load() {
        const { group, userId, canAdmin } = getState();
        if (!group || !userId || !canAdmin) return;
        const requestedGroupId = group.id;
        withGlobalLoading(() => getGroupClans(group.id, userId)
            .then(data => {
                if (getState().group?.id !== requestedGroupId) return;
                setLinkedClans(data, requestedGroupId);
            })
            .catch(error => {
                if (getState().group?.id !== requestedGroupId) return;
                console.error(error);
                setLinkedClans([], requestedGroupId);
                setMessage(t('groups.linkedClansLoadError'));
            }), t('groups.loading'));
    }

    function add() {
        const { group, userId, canAdmin } = getState();
        const tag = normalizeTag(elements.clanTag?.value);
        if (!group || !userId || !canAdmin || !tag) return setMessage(t('groups.enterClanTag'));
        if (linkedClans.some(clan => normalizeTag(clan.clan_tag) === tag)) return setMessage(t('groups.clanAlreadyLinked'));

        withGlobalLoading(() => getClanInfoRequest(tag)
            .then(info => {
                const officialBadgeUrl = badgeUrl(info);
                return addGroupClan(group.id, userId, {
                    tag: normalizeTag(info?.tag || tag),
                    name: info?.name || tag,
                    badgeUrl: officialBadgeUrl
                }).then(() => {
                    if (!group.badge_url && officialBadgeUrl) {
                        group.badge_url = officialBadgeUrl;
                        renderBadge(document.querySelector('#groups-detail-logo'), group.badge, group.badge_url);
                    }
                });
            })
            .then(() => {
                if (elements.clanTag) elements.clanTag.value = '';
                setMessage(t('groups.clanLinked'), 'success');
                load();
            })
            .catch(error => {
                console.error(error);
                setMessage(t('groups.clanLinkError'));
            }), t('groups.loading'));
    }

    function remove(clanTag) {
        const { group, userId, canAdmin } = getState();
        const tag = normalizeTag(clanTag);
        if (!group || !userId || !canAdmin || !tag) return;

        withGlobalLoading(() => removeGroupClan(group.id, userId, tag)
            .then(() => {
                linkedClans = linkedClans.filter(clan => normalizeTag(clan.clan_tag) !== tag);
                renderLinkedClans();
                window.dispatchEvent(new CustomEvent('clashtools:group-clans-updated', {
                    detail: { groupId: group.id, count: linkedClans.length }
                }));
                renderScanPlaceholder(t('groups.scanFirst'));
                setMessage(t('groups.clanRemoved'), 'success');
            })
            .catch(error => {
                console.error(error);
                setMessage(t('groups.clanRemoveError'));
            }), t('groups.loading'));
    }

    function renderLinkedClans() {
        elements.linkedClans?.replaceChildren();
        if (!linkedClans.length) return elements.linkedClans?.appendChild(emptyMessage(t('groups.noLinkedClans')));
        linkedClans.forEach(clan => elements.linkedClans?.appendChild(linkedClanNode(clan)));
    }

    function linkedClanNode(clan) {
        const item = document.createElement('div');
        item.className = 'groups-linked-clan';
        const badge = document.createElement('div');
        badge.className = 'groups-linked-clan-badge';
        if (clan.badge_url) badge.appendChild(Object.assign(document.createElement('img'), { src: clan.badge_url, alt: '' }));
        const text = document.createElement('div');
        text.className = 'groups-linked-clan-text';
        text.append(textNode('strong', clan.clan_name || clan.clan_tag), textNode('span', normalizeTag(clan.clan_tag)));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-groups-icon groups-danger';
        btn.title = t('groups.removeClan');
        btn.textContent = 'x';
        btn.addEventListener('click', () => remove(clan.clan_tag));
        item.append(badge, text, btn);
        return item;
    }

    function textNode(tagName, text) {
        const node = document.createElement(tagName);
        node.textContent = text;
        return node;
    }

    function renderScanPlaceholder(message) {
        elements.unlinkedAccounts?.replaceChildren(emptyMessage(message));
    }

    function scan() {
        const { members } = getState();
        if (!linkedClans.length) return renderScanPlaceholder(t('groups.noLinkedClans'));
        withGlobalLoading(async () => renderUnlinkedAccounts(await findUnlinkedAccounts(members)), t('groups.loading'))
            .catch(error => {
                console.error(error);
                renderScanPlaceholder(t('groups.scanError'));
            });
    }

    async function findUnlinkedAccounts(members) {
        const linkedTags = await getLinkedAccountTags(members);
        const missing = [];
        for (const clan of linkedClans) {
            const liveMembers = memberItems(await getClanMembersRequest(normalizeTag(clan.clan_tag)));
            liveMembers.forEach(member => addMissingMember(missing, member, linkedTags, clan));
        }
        return missing;
    }

    async function getLinkedAccountTags(members) {
        const tags = new Set();
        (members || []).forEach(member => accountTags(member.profile).forEach(tag => tags.add(tag)));
        return tags;
    }

    function accountTags(user) {
        return (Array.isArray(user?.accounts) ? user.accounts : [])
            .map(account => normalizeTag(account?.tag || account?.playerTag || account?.accountTag || account?.clashTag))
            .filter(Boolean);
    }

    function memberItems(response) {
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.items)) return response.items;
        if (Array.isArray(response?.memberList)) return response.memberList;
        return [];
    }

    function addMissingMember(missing, member, linkedTags, clan) {
        const tag = normalizeTag(member?.tag);
        if (!tag || linkedTags.has(tag)) return;
        missing.push({ name: member?.name || tag, tag, townHall: member?.townHallLevel || member?.townHall || '', clan: clan.clan_name });
    }

    function renderUnlinkedAccounts(accounts) {
        elements.unlinkedAccounts?.replaceChildren();
        if (!accounts.length) return elements.unlinkedAccounts?.appendChild(emptyMessage(t('groups.noUnlinkedAccounts')));
        accounts.forEach(account => elements.unlinkedAccounts?.appendChild(unlinkedNode(account)));
    }

    function unlinkedNode(account) {
        const item = document.createElement('div');
        item.className = 'groups-unlinked-account';
        const main = document.createElement('div');
        main.className = 'groups-unlinked-account-main';
        const th = account.townHall ? `TH${account.townHall} - ` : '';
        main.append(textNode('strong', account.name), textNode('span', `${th}${account.tag} - ${account.clan}`));
        const status = textNode('span', t('groups.notLinkedToMember'));
        status.className = 'groups-unlinked-status';
        item.append(main, status);
        return item;
    }

    function reset() {
        linkedClans = [];
        renderLinkedClans();
        renderScanPlaceholder(t('groups.scanFirst'));
    }

    elements.addClan?.addEventListener('click', add);
    elements.clanTag?.addEventListener('keydown', event => { if (event.key === 'Enter') add(); });
    elements.scanUnlinked?.addEventListener('click', scan);

    return { load, reset };
}
