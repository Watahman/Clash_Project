const DISPLAY_CATEGORIES = new Set([
    'TROOP',
    'SUPER_TROOP',
    'SPELL',
    'SIEGE',
    'CLAN_CASTLE_TROOP',
    'CLAN_CASTLE_SPELL',
    'HERO',
    'PET',
    'EQUIPMENT'
]);

const CORE_CATEGORIES = new Set(['TROOP', 'SUPER_TROOP']);
const CATEGORY_ORDER = new Map([
    ['TROOP', 0],
    ['SUPER_TROOP', 1],
    ['SPELL', 2],
    ['SIEGE', 3],
    ['CLAN_CASTLE_TROOP', 4],
    ['CLAN_CASTLE_SPELL', 5],
    ['HERO', 6],
    ['PET', 7],
    ['EQUIPMENT', 8]
]);

function normalizedCategory(value) {
    return String(value || '').trim().toUpperCase();
}

function unitKey(unit) {
    return String(unit?.key || unit?.unitKey || unit?.unit_key || '').trim();
}

function unitName(unit) {
    return String(unit?.name || unit?.unitName || unit?.unit_name || '').trim();
}

function unitIdentity(unit) {
    return `${normalizedCategory(unit?.category)}:${unitKey(unit)}`;
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
        const name = unitName(unit);
        if (!isPlayerFacingUnitName(name)) continue;
        names.set(unitIdentity(unit), name);
    }
    return names;
}

export function displayArmyUnits(army, unitCatalog) {
    const names = unitNameLookup(unitCatalog);
    return (Array.isArray(army?.units) ? army.units : [])
        .map(unit => ({
            category: normalizedCategory(unit?.category),
            key: unitKey(unit),
            name: unitName(unit) || names.get(unitIdentity(unit)) || '',
            quantity: Math.max(0, Number(unit?.quantity || 0))
        }))
        .filter(unit => DISPLAY_CATEGORIES.has(unit.category)
            && isPlayerFacingUnitName(unit.name)
            && unit.quantity > 0)
        .sort((left, right) => {
            const categoryDifference = (CATEGORY_ORDER.get(left.category) ?? 99)
                - (CATEGORY_ORDER.get(right.category) ?? 99);
            if (categoryDifference) return categoryDifference;
            if (right.quantity !== left.quantity) return right.quantity - left.quantity;
            return left.name.localeCompare(right.name);
        });
}

export function presentArmy(army, unitCatalog, fallbackLabel) {
    const units = displayArmyUnits(army, unitCatalog);

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
