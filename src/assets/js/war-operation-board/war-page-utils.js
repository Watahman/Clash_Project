export function fixtureWar(fixture) {
    const raw = fixture?.data?.currentWar || { state: 'notInWar' };
    if (!raw.clan && !raw.opponent) return raw;
    const badgeUrl = fixture.data?.clan?.badgeUrl || '';
    return {
        ...raw,
        clan: { ...raw.clan, badgeUrl: raw.clan?.badgeUrl || badgeUrl },
        opponent: { ...raw.opponent }
    };
}

export function setEmptyState(element, title, copy, cwlLink = false) {
    const titleElement = element.querySelector('[data-war-empty-title]');
    const copyElement = element.querySelector('[data-war-empty-copy]');
    if (titleElement) titleElement.textContent = title;
    if (!copyElement) return;
    copyElement.textContent = copy;
    if (cwlLink) {
        const link = document.createElement('a');
        link.href = '/app/cwl-tracker';
        link.textContent = ' Open CWL Tracker';
        copyElement.append(link);
    }
}
