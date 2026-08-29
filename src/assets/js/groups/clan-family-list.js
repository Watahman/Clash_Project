import { getGroupsOfUser } from '../Supabase/Supabase-Group.js?v=20260829-public-auth-v1';
import { getCurrentUserId } from '../utils/user.js';
import { withGlobalLoading } from '../utils/loading-state.js?v=20260829-public-auth-v1';
import { createGroupCard } from '../templates/GroupTemplates.js?v=20260829-public-auth-v1';
import { loadClanFamilyFixture } from './clan-family-fixtures.js';
import { familyCopy } from './clan-family-copy.js?v=20260829-public-auth-v1';
import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { OPEN_GROUP_STORAGE_KEY } from '../notifications/poll-notifications.js';

const DEFAULT_SELECTED_GROUP_KEY = 'clashtoolsSelectedGroupId';
const DEFAULT_STORAGE = () => window.localStorage;
const DEFAULT_SESSION = () => window.sessionStorage;

export function createClanFamilyListController({
    refs,
    state,
    resetGroupDetail,
    emptyMessage,
    selectedGroupKey = DEFAULT_SELECTED_GROUP_KEY,
    getUserId = getCurrentUserId,
    fetchGroups = getGroupsOfUser,
    getFixture = loadClanFamilyFixture,
    createCards = createGroupCard,
    loading = withGlobalLoading,
    translate = t,
    copy = familyCopy,
    localStore = DEFAULT_STORAGE(),
    sessionStore = DEFAULT_SESSION()
}) {
    refs.retry?.addEventListener('click', () => void reload());
    return { reload };

    async function reload() {
        const sequence = ++state.reload;
        renderListLoading();
        try {
            const fixture = await getFixture();
            if (fixture) {
                state.fixture = fixture;
                state.userId = fixture.currentUserId;
                return renderGroupList(fixture.entries, fixture.currentUserId, sequence);
            }
            state.fixture = null;
            const userId = getUserId();
            if (!userId) return showLoginState();
            const memberships = await loading(() => fetchGroups(userId), translate('groups.loading'));
            if (sequence !== state.reload) return;
            const requestedGroupId = requestedGroupIdFromStorage();
            await renderGroupList(memberships, userId, sequence, requestedGroupId);
            sessionStore.removeItem(OPEN_GROUP_STORAGE_KEY);
        } catch (error) {
            if (sequence !== state.reload) return;
            console.error(error);
            showListError();
        }
    }

    async function renderGroupList(entries, userId, sequence, requestedGroupId = '') {
        refs.list?.replaceChildren();
        const safeEntries = Array.isArray(entries) ? entries : [];
        if (refs.listCount) refs.listCount.textContent = String(safeEntries.length);
        if (!safeEntries.length) return showEmptyFamily();
        const cardOptions = {
            currentUserId: userId,
            fixture: state.fixture,
            autoOpenGroupId: requestedGroupId || safeEntries[0]?.group?.id,
            autoOpenFirst: true
        };
        if (state.fixture) cardOptions.entries = safeEntries;
        const opened = await createCards(
            safeEntries.map(entry => entry.membership || entry),
            cardOptions
        );
        if (sequence !== state.reload) return;
        if (!opened) showListError();
    }

    function requestedGroupIdFromStorage() {
        return sessionStore.getItem(OPEN_GROUP_STORAGE_KEY)
            || localStore.getItem(selectedGroupKey)
            || '';
    }

    function renderListLoading() {
        refs.list?.replaceChildren();
        for (let index = 0; index < 4; index += 1) {
            const row = document.createElement('div');
            row.className = 'cf-list-skeleton';
            row.setAttribute('aria-hidden', 'true');
            refs.list?.appendChild(row);
        }
    }

    function showEmptyFamily() {
        resetGroupDetail();
        refs.list?.appendChild(emptyMessage(translate('groups.none')));
        setEmptyCopy('familyEmptyTitle', 'familyEmptyBody');
        refs.emptyCreate?.classList.remove('hidden');
        refs.emptyJoin?.classList.remove('hidden');
    }

    function showLoginState() {
        resetGroupDetail();
        refs.list?.replaceChildren(emptyMessage(translate('groups.login')));
        if (refs.emptyTitle) refs.emptyTitle.textContent = translate('groups.login');
        if (refs.emptyBody) refs.emptyBody.textContent = copy('familyEmptyBody');
        refs.emptyCreate?.classList.add('hidden');
        refs.emptyJoin?.classList.add('hidden');
    }

    function showListError() {
        refs.list?.replaceChildren();
        const message = emptyMessage(translate('groups.loadError'));
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'button button-secondary button-small';
        retry.textContent = copy('retry');
        retry.addEventListener('click', () => void reload());
        message.appendChild(retry);
        refs.list?.appendChild(message);
        resetGroupDetail();
    }

    function setEmptyCopy(titleKey, bodyKey) {
        if (refs.emptyTitle) refs.emptyTitle.textContent = copy(titleKey);
        if (refs.emptyBody) refs.emptyBody.textContent = copy(bodyKey);
    }
}
