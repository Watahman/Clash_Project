export function hideProfileEmptyStateFor(tabId, root = document) {
    const activeTab = root.querySelector('.po-tab.po-tab-active');
    if (activeTab?.id !== tabId) return false;

    const emptyState = root.querySelector('.po-panel-content > .po-empty');
    if (!emptyState) return false;

    emptyState.classList.add('hidden');
    return true;
}
