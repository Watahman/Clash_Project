function normalizeSearchText(value = '') {
    return String(value)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLocaleLowerCase();
}

function updatedTimestamp(value) {
    const timestamp = Date.parse(value || '');
    return Number.isFinite(timestamp) ? timestamp : null;
}

function filterAndSortPlans(plans = [], { query = '', sort = 'updated-desc', language = 'nl' } = {}) {
    const normalizedQuery = normalizeSearchText(query);
    const collator = new Intl.Collator(language, { sensitivity: 'base', numeric: true });
    const nameOf = plan => String(plan?.name || '');
    const compareNames = (a, b) => collator.compare(nameOf(a), nameOf(b));
    const compareRecent = (a, b) => {
        const aTime = updatedTimestamp(a?.updatedAt);
        const bTime = updatedTimestamp(b?.updatedAt);
        if (aTime == null && bTime == null) return compareNames(a, b);
        if (aTime == null) return 1;
        if (bTime == null) return -1;
        return bTime - aTime || compareNames(a, b);
    };

    return plans
        .filter(plan => !normalizedQuery || normalizeSearchText(nameOf(plan)).includes(normalizedQuery))
        .slice()
        .sort((a, b) => {
            if (sort === 'updated-asc') {
                const aTime = updatedTimestamp(a?.updatedAt);
                const bTime = updatedTimestamp(b?.updatedAt);
                if (aTime == null && bTime == null) return compareNames(a, b);
                if (aTime == null) return 1;
                if (bTime == null) return -1;
                return aTime - bTime || compareNames(a, b);
            }
            if (sort === 'name-asc') return compareNames(a, b) || compareRecent(a, b);
            if (sort === 'name-desc') return -compareNames(a, b) || compareRecent(a, b);
            return compareRecent(a, b);
        });
}

export { filterAndSortPlans, normalizeSearchText, updatedTimestamp };
