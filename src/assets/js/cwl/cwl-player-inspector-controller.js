const CARD_CONTROL_SELECTOR = 'button, select, input, textarea, a';

export function createPlayerInspectorController({
    root,
    drawer,
    body,
    backdrop,
    closeButton,
    renderInspector
}) {
    const document = getOwnerDocument(root);
    const view = document.defaultView || globalThis;
    const state = { activeCard: null, lastFocused: null };
    const close = () => closeInspector({ document, drawer, backdrop, state });
    const open = card => openInspector({
        card,
        document,
        drawer,
        backdrop,
        closeButton,
        body,
        state,
        renderInspector
    });

    wireCardTriggers(root, open);
    wireDialogControls({ document, drawer, backdrop, closeButton, close });
    wireWindowEvents({ view, body, state, close, renderInspector });
    return { open, close, getActive: () => state.activeCard };
}

function getOwnerDocument(root) {
    return root?.nodeType === 9 ? root : root?.ownerDocument || document;
}

function openInspector({
    card,
    document,
    drawer,
    backdrop,
    closeButton,
    body,
    state,
    renderInspector
}) {
    if (!card?.matches('.cwl-player-article[data-planner-card="true"]')) return;
    state.activeCard?.setAttribute('aria-expanded', 'false');
    state.activeCard = card;
    state.lastFocused = document.activeElement;
    card.setAttribute('aria-expanded', 'true');
    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop?.classList.remove('hidden');
    document.body?.classList.add('cwl-inspector-open');
    renderInspector(body, card);
    focusElement(closeButton);
}

function closeInspector({ document, drawer, backdrop, state }) {
    state.activeCard?.setAttribute('aria-expanded', 'false');
    state.activeCard = null;
    drawer.classList.add('hidden');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop?.classList.add('hidden');
    document.body?.classList.remove('cwl-inspector-open');
    focusElement(state.lastFocused);
    state.lastFocused = null;
}

function wireCardTriggers(root, open) {
    root.addEventListener('click', event => {
        const target = event.target;
        const card = target.closest?.('.cwl-player-article[data-planner-card="true"]');
        if (!card || target.closest(CARD_CONTROL_SELECTOR)) return;
        open(card);
    });
    root.addEventListener('keydown', event => {
        if (!['Enter', ' '].includes(event.key)) return;
        const trigger = event.target.closest?.('.cwl-player-info');
        const card = trigger?.closest('.cwl-player-article[data-planner-card="true"]');
        if (!card) return;
        event.preventDefault();
        open(card);
    });
}

function wireDialogControls({ document, drawer, backdrop, closeButton, close }) {
    closeButton?.addEventListener('click', close);
    backdrop?.addEventListener('click', close);
    document.addEventListener('keydown', event => handleDialogKeydown(event, drawer, close));
}

function handleDialogKeydown(event, drawer, close) {
    if (drawer.classList.contains('hidden')) return;
    if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
    }
    if (event.key === 'Tab') trapFocus(event, drawer);
}

function wireWindowEvents({ view, body, state, close, renderInspector }) {
    view.addEventListener('clashtools:player-performance-updated', () => {
        renderActiveInspector({ body, state, renderInspector });
    });
    view.addEventListener('clashtools:language-changed', () => {
        renderActiveInspector({ body, state, renderInspector });
    });
    view.addEventListener('clashtools:cwl-plan-loaded', close);
}

function renderActiveInspector({ body, state, renderInspector }) {
    if (state.activeCard?.isConnected) renderInspector(body, state.activeCard);
}

function focusElement(element) {
    if (element?.isConnected) element.focus?.({ preventScroll: true });
}

function trapFocus(event, container) {
    const focusable = Array.from(container.querySelectorAll(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && container.ownerDocument.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && container.ownerDocument.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
