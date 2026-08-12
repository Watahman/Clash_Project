import { getLanguage } from '../i18n/i18n.js';

const VIEW_COPY = Object.freeze({
    en: Object.freeze({ fit: 'Fit', fitLabel: 'Fit bracket to view', zoomOut: 'Zoom out', zoomIn: 'Zoom in', reset: 'Reset view' }),
    nl: Object.freeze({ fit: 'Passend', fitLabel: 'Bracket passend in beeld', zoomOut: 'Uitzoomen', zoomIn: 'Inzoomen', reset: 'Weergave resetten' }),
    fr: Object.freeze({ fit: 'Ajuster', fitLabel: 'Ajuster le bracket à la vue', zoomOut: 'Dézoomer', zoomIn: 'Zoomer', reset: 'Réinitialiser la vue' }),
    de: Object.freeze({ fit: 'Einpassen', fitLabel: 'Turnierbaum an Ansicht anpassen', zoomOut: 'Verkleinern', zoomIn: 'Vergrößern', reset: 'Ansicht zurücksetzen' }),
    es: Object.freeze({ fit: 'Ajustar', fitLabel: 'Ajustar el cuadro a la vista', zoomOut: 'Alejar', zoomIn: 'Acercar', reset: 'Restablecer vista' })
});

const MIN_SCALE = 0.65;
const MAX_SCALE = 1.25;
const SCALE_STEP = 0.1;

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function copy() {
    return VIEW_COPY[getLanguage()] || VIEW_COPY.en;
}

function createButton(documentRef, id, text, className = 'cp-button cp-button--ghost') {
    const button = documentRef.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    return button;
}

function ensureStyles(documentRef) {
    if (documentRef.querySelector('#bracket-view-v2-styles')) return;
    const link = documentRef.createElement('link');
    link.id = 'bracket-view-v2-styles';
    link.rel = 'stylesheet';
    link.href = new URL('../../css/pages/bracket-generator-v2.css?v=20260812-bracket-view', import.meta.url).href;
    documentRef.head.appendChild(link);
}

function mountControls(documentRef, refs) {
    const navigation = refs.roundNavigation;
    if (!navigation || navigation.querySelector('#bracket-view-controls')) return null;

    const label = navigation.querySelector('.bracket-round-navigation-label');
    const navigationControls = navigation.querySelector('.bracket-round-navigation-controls');
    if (!label || !navigationControls) return null;

    const topbar = documentRef.createElement('div');
    topbar.className = 'bracket-round-navigation-topbar';
    const controls = documentRef.createElement('div');
    controls.id = 'bracket-view-controls';
    controls.className = 'bracket-view-controls';
    controls.setAttribute('role', 'group');

    const fit = createButton(documentRef, 'bracket-view-fit', 'Fit');
    const zoomOut = createButton(documentRef, 'bracket-view-zoom-out', '−', 'cp-button cp-button--ghost bracket-view-icon-button');
    const level = documentRef.createElement('output');
    level.id = 'bracket-view-zoom-level';
    level.className = 'bracket-view-zoom-level';
    level.setAttribute('aria-live', 'polite');
    level.textContent = '100%';
    const zoomIn = createButton(documentRef, 'bracket-view-zoom-in', '+', 'cp-button cp-button--ghost bracket-view-icon-button');
    const reset = createButton(documentRef, 'bracket-view-reset', 'Reset');

    controls.append(fit, zoomOut, level, zoomIn, reset);
    topbar.append(label, controls);
    navigation.insertBefore(topbar, navigationControls);

    return { controls, fit, zoomOut, level, zoomIn, reset };
}

function updateControlCopy(viewRefs) {
    if (!viewRefs) return;
    const text = copy();
    viewRefs.fit.textContent = text.fit;
    viewRefs.fit.setAttribute('aria-label', text.fitLabel);
    viewRefs.fit.title = text.fitLabel;
    viewRefs.zoomOut.setAttribute('aria-label', text.zoomOut);
    viewRefs.zoomOut.title = text.zoomOut;
    viewRefs.zoomIn.setAttribute('aria-label', text.zoomIn);
    viewRefs.zoomIn.title = text.zoomIn;
    viewRefs.reset.textContent = text.reset;
    viewRefs.reset.setAttribute('aria-label', text.reset);
}

function updateChampionState(refs) {
    const champion = refs.resultChampion?.textContent?.trim();
    const complete = Boolean(champion && champion !== '—');
    refs.resultChampion?.closest('.bracket-result-meta')
        ?.setAttribute('data-champion-state', complete ? 'complete' : 'pending');
}

function scaleVariables(board, scale) {
    const rounded = Math.round(scale * 100) / 100;
    board.style.setProperty('--bracket-view-scale', String(rounded));
    board.style.setProperty('--bracket-round-width', `${Math.round(220 * rounded)}px`);
    board.style.setProperty('--bracket-round-gap', `${Math.round(48 * rounded)}px`);
    board.style.setProperty('--bracket-board-padding', `${Math.max(14, Math.round(24 * rounded))}px`);
    board.style.setProperty('--bracket-match-min', `${Math.max(78, Math.round(96 * rounded))}px`);
    board.style.setProperty('--bracket-slot-min', `${Math.max(36, Math.round(40 * rounded))}px`);
    return rounded;
}

function fitScale(board, windowRef) {
    if (windowRef.matchMedia?.('(max-width: 899px)').matches) return 1;
    const rounds = board.querySelectorAll('.bracket-round').length;
    if (!rounds) return 1;
    const available = Math.max(1, board.clientWidth - 28);
    const naturalWidth = (rounds * 220) + (Math.max(0, rounds - 1) * 48) + 48;
    return clamp(available / naturalWidth, MIN_SCALE, 1);
}

export function initBracketViewControls({
    refs,
    controller,
    documentRef = globalThis.document,
    windowRef = globalThis.window
} = {}) {
    if (!refs?.board || !refs?.roundNavigation) return null;
    ensureStyles(documentRef);
    const viewRefs = mountControls(documentRef, refs);
    if (!viewRefs) return null;

    let scale = 1;
    const redraw = () => windowRef.requestAnimationFrame?.(() => controller.redrawConnectors());
    const applyScale = nextScale => {
        scale = scaleVariables(refs.board, clamp(nextScale, MIN_SCALE, MAX_SCALE));
        viewRefs.level.textContent = `${Math.round(scale * 100)}%`;
        viewRefs.zoomOut.disabled = scale <= MIN_SCALE + 0.001;
        viewRefs.zoomIn.disabled = scale >= MAX_SCALE - 0.001;
        redraw();
    };

    viewRefs.fit.addEventListener('click', () => applyScale(fitScale(refs.board, windowRef)));
    viewRefs.zoomOut.addEventListener('click', () => applyScale(scale - SCALE_STEP));
    viewRefs.zoomIn.addEventListener('click', () => applyScale(scale + SCALE_STEP));
    viewRefs.reset.addEventListener('click', () => {
        applyScale(1);
        refs.board.scrollTo?.({ left: 0, top: 0 });
    });

    updateControlCopy(viewRefs);
    updateChampionState(refs);
    applyScale(1);

    const championObserver = new MutationObserver(() => updateChampionState(refs));
    if (refs.resultChampion) {
        championObserver.observe(refs.resultChampion, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    windowRef.addEventListener('clashtools:language-changed', () => updateControlCopy(viewRefs));

    return {
        fit: () => applyScale(fitScale(refs.board, windowRef)),
        reset: () => applyScale(1),
        destroy: () => championObserver.disconnect()
    };
}
