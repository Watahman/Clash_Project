import {
    applyCwlFixture,
    setSourceMode
} from './operation-board-fixture-controls.js';
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

    function bindSourceMode() {
        root.querySelectorAll('[data-op-source-mode]').forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.opSourceMode;
                const wasActive = button.getAttribute('aria-pressed') === 'true';
                setSourceMode(mode, root);
                if (!wasActive) onSourceModeChange?.(mode);
            });
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
