import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';

export function initClanFamilyMembers() {
    const search = document.querySelector('#groups-member-search');
    const role = document.querySelector('#groups-member-role-filter');
    const linked = document.querySelector('#groups-member-link-filter');
    const empty = document.querySelector('#groups-members-filter-empty');
    const count = document.querySelector('#groups-members-filter-count');
    const state = { query: '', role: 'all', linked: 'all' };

    [search, role, linked].filter(Boolean).forEach(control => control.addEventListener('input', () => {
        state.query = search?.value.trim().toLowerCase() || '';
        state.role = role?.value || 'all';
        state.linked = linked?.value || 'all';
        applyFilter();
    }));
    window.addEventListener('clashtools:group-opened', () => {
        state.query = '';
        state.role = 'all';
        state.linked = 'all';
        if (search) search.value = '';
        if (role) role.value = 'all';
        if (linked) linked.value = 'all';
        applyFilter();
    });
    window.addEventListener('clashtools:group-roles-updated', applyFilter);

    function applyFilter() {
        const rows = [...document.querySelectorAll('#groups-member-list .groups-member-item')];
        let visible = 0;
        rows.forEach(row => {
            const matchesQuery = !state.query || row.textContent.toLowerCase().includes(state.query);
            const matchesRole = state.role === 'all' || row.dataset.role === state.role;
            const matchesLinked = state.linked === 'all' || (state.linked === 'linked' ? row.dataset.hasAccounts === 'true' : row.dataset.hasAccounts !== 'true');
            const show = matchesQuery && matchesRole && matchesLinked;
            row.hidden = !show;
            if (show) visible += 1;
        });
        if (count) count.textContent = `${visible} ${visible === 1 ? t('groups.memberSingle') : t('groups.members')}`;
        if (empty) empty.hidden = !rows.length || visible > 0;
    }

    applyFilter();
    return { applyFilter };
}
