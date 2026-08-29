import { setEmptyState } from './war-page-utils.js?v=20260829-public-auth-v1';

function resetWarSelection({
    refs,
    setSelectedTag,
    setMapSide,
    setSelectedPosition
}) {
    setSelectedTag('');
    setMapSide('own');
    setSelectedPosition(1);
    refs.tagInput.value = '';
    refs.clanSelect.value = '';
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('clan');
    window.history.replaceState(null, '', nextUrl);
}

function clearWarBoard(refs) {
    refs.content.hidden = true;
    refs.empty.hidden = false;
    refs.refresh.disabled = true;
    [refs.score, refs.liveMap, refs.detail, refs.stats, refs.roster,
        refs.historySummary, refs.historyList].forEach(element =>
        element?.replaceChildren()
    );
}

export function resetWarSourceState({
    refs,
    loader,
    createLoader,
    setLoader,
    setSelectedTag,
    setMapSide,
    setSelectedPosition,
    competeT,
    setStatus
}) {
    loader?.cancel();
    setLoader(createLoader());
    resetWarSelection({
        refs,
        setSelectedTag,
        setMapSide,
        setSelectedPosition
    });
    clearWarBoard(refs);
    setEmptyState(
        refs.empty,
        competeT('war.empty.selectTitle'),
        competeT('war.empty.selectCopy')
    );
    setStatus('');
}

export function renderGuestWarClanOption({ refs, competeT, loginLabel }) {
    refs.clanSelect.replaceChildren();
    const option = document.createElement('option');
    option.value = '';
    option.disabled = true;
    option.selected = true;
    option.textContent = `${competeT('war.selectLinkedClan')} · ${loginLabel}`;
    refs.clanSelect.appendChild(option);
    refs.clanSelect.disabled = true;
}
