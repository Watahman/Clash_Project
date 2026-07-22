export function getNameInitials(name, fallback = 'CT') {
    const parts = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const initials = parts
        .slice(0, 2)
        .map(part => Array.from(part)[0] || '')
        .join('');

    return (initials || fallback).toUpperCase();
}