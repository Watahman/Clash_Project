const DISPLAY_CATEGORIES = new Set([
    'TROOP',
    'SUPER_TROOP',
    'SPELL',
    'SIEGE',
    'CLAN_CASTLE_TROOP',
    'CLAN_CASTLE_SPELL'
]);

const CORE_CATEGORIES = new Set(['TROOP', 'SUPER_TROOP']);
const CATEGORY_ORDER = new Map([
    ['TROOP', 0],
    ['SUPER_TROOP', 1],
    ['SPELL', 2],
    ['SIEGE', 3],
    ['CLAN_CASTLE_TROOP', 4],
    ['CLAN_CASTLE_SPELL', 5]
]);

function normalizedCategory(value) {
    return String(value || '').trim().toUpperCase();
}

function unitIdentity(unit) {
    return `${normalizedCategory(unit?.category)}:${String(unit?.key || unit?.unitKey || '').trim()}`;
}

export function isPlayerFacingUnitName(value) {
    const name = String(value || '').trim();
    if (!name) return false;
    if (/^unknown\b.*\(\d+\)$/i.test(name)) return false;
    return !/^[a-z_]+:\d+$/i.test(name);
}

function unitNameLookup(unitCatalog) {
    const names = new Map();
    for (const unit of Array.isArray(unitCatalog) ? unitCatalog : []) {
        const name = String(unit?.name || unit?.unitName || '').trim();
        if (!isPlayerFacingUnitName(name)) continue;
        names.set(unitIdentity(unit), name);
    }
    return names;
}

export function presentArmy(army, unitCatalog, fallbackLabel) {
    const names = unitNameLookup(unitCatalog);
    const units = (Array.isArray(army?.units) ? army.units : [])
        .map(unit => ({
            category: normalizedCategory(unit?.category),
            key: String(unit?.key || unit?.unitKey || '').trim(),
            name: String(unit?.name || unit?.unitName || names.get(unitIdentity(unit)) || '').trim(),
            quantity: Math.max(0, Number(unit?.quantity || 0))
        }))
        .filter(unit => DISPLAY_CATEGORIES.has(unit.category) && isPlayerFacingUnitName(unit.name))
        .sort((left, right) => {
            const categoryDifference = (CATEGORY_ORDER.get(left.category) ?? 99)
                - (CATEGORY_ORDER.get(right.category) ?? 99);
            if (categoryDifference) return categoryDifference;
            if (right.quantity !== left.quantity) return right.quantity - left.quantity;
            return left.name.localeCompare(right.name);
        });

    const core = units.filter(unit => CORE_CATEGORIES.has(unit.category));
    const headlineUnits = (core.length ? core : units).slice(0, 2);
    const label = headlineUnits.length
        ? headlineUnits.map(unit => `${unit.quantity}× ${unit.name}`).join(' + ')
        : fallbackLabel;

    return {
        label,
        units: units.slice(0, 14).map(unit => `${unit.quantity}× ${unit.name}`),
        hiddenCount: Math.max(0, units.length - 14)
    };
}
