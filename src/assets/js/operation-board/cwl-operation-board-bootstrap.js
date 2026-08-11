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
            button.addEventListener('click', () =>
                setSourceMode(button.dataset.opSourceMode, root)
            );
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
