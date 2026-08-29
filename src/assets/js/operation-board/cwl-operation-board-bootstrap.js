import {
    applyCwlFixture,
    setSourceMode
} from './operation-board-fixture-controls.js?v=20260829-public-auth-v1';
import { loadCwlFixture } from './operation-board-fixtures.js';

export function createCwlOperationBoardBootstrap({
    refs,
    renderClanSelector,
    refreshClanReport,
    loadPlans,
    setSelectedPlan,
    setSelectedClan,
    setHelp,
    onSourceModeChange,
    onSourceModeRequest,
    root = document
}) {
    let activeFixture = null;

    async function loadFixture() {
        activeFixture = await loadCwlFixture().catch(error => {
            console.error(error);
            return null;
        });
        setSourceMode('plan', root);
        return activeFixture;
    }

    function usesFixture() {
        return Boolean(activeFixture);
    }

    function setMode(mode) {
        setSourceMode(mode, root);
    }

    async function handleSourceModeClick(button) {
        const mode = button.dataset.opSourceMode;
        const wasActive = button.getAttribute('aria-pressed') === 'true';
        if (wasActive) return;
        const allowed = await onSourceModeRequest?.(mode);
        if (allowed === false) return;
        setSourceMode(mode, root);
        onSourceModeChange?.(mode);
    }

    function bindSourceMode() {
        root.querySelectorAll('[data-op-source-mode]').forEach(button => {
            button.addEventListener('click', () => void handleSourceModeClick(button));
        });
    }

    async function loadInitialSource() {
        if (!activeFixture) return loadPlans();
        return applyCwlFixture(activeFixture, {
            refs,
            renderClanSelector,
            refreshClanReport,
            setSelectedPlan,
            setSelectedClan,
            setHelp
        });
    }

    return {
        bindSourceMode,
        loadFixture,
        loadInitialSource,
        setMode,
        usesFixture
    };
}
