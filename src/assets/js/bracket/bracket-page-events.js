export function bindBracketEvents({ refs, controller, windowRef }) {
    bindGenerationEvents(refs, controller);
    bindFileEvents(refs, controller);
    bindResetEvents(refs, controller);
    bindNavigationEvents(refs, controller);
    bindWindowEvents(refs, controller, windowRef);
}

function bindGenerationEvents(refs, controller) {
    refs.seed.addEventListener('click', () => controller.generate(false));
    refs.shuffle.addEventListener('click', () => controller.generate(true));
    refs.name.addEventListener('input', () => controller.updateInputSummary());
    refs.participants.addEventListener('input', () => controller.updateInputSummary());
}

function bindFileEvents(refs, controller) {
    refs.exportButton.addEventListener('click', () => controller.exportJson());
    refs.importButton.addEventListener('click', () => refs.importFile.click());
    refs.importFile.addEventListener('change', event => void controller.importJson(event));
}

function bindResetEvents(refs, controller) {
    refs.reset.addEventListener('click', () => controller.openResetDialog());
    refs.resetConfirm.addEventListener('click', () => controller.confirmReset());
    refs.resetCancel.addEventListener('click', () => controller.closeResetDialog());
    refs.resetDialog.addEventListener('cancel', event => controller.cancelReset(event));
}

function bindNavigationEvents(refs, controller) {
    refs.setupToggle.addEventListener('click', () => controller.toggleSetup());
    refs.roundPrev.addEventListener('click', () => controller.changeRound(-1));
    refs.roundNext.addEventListener('click', () => controller.changeRound(1));
}

function bindWindowEvents(refs, controller, windowRef) {
    refs.board.addEventListener('scroll', () => controller.redrawConnectors(), { passive: true });
    windowRef.addEventListener('resize', () => controller.redrawConnectors(), { passive: true });
    windowRef.addEventListener('clashtools:language-changed', () => controller.languageChanged());
}
