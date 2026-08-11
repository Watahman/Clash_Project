import { bindBackdropClick } from "../utils/backdrop-click.js";

export function initOverlayDismissal(onReset) {
    document.querySelectorAll(".overlay").forEach(overlay => {
        bindBackdropClick(overlay, () => closeOverlay(overlay, onReset));
    });
    document.querySelectorAll('[data-overlay-close]').forEach(button => {
        button.addEventListener('click', () => {
            closeOverlay(document.getElementById(button.dataset.overlayClose), onReset);
        });
    });
    document.addEventListener('keydown', event => {
        const overlay = document.querySelector('.overlay:not(.hidden)');
        if (!overlay) return;
        if (event.key === 'Escape') {
            closeOverlay(overlay, onReset);
            return;
        }
        if (event.key === 'Tab') trapOverlayFocus(event, overlay);
    });
}

function closeOverlay(overlay, onReset) {
    overlay?.classList.add('hidden');
    onReset();
}

function trapOverlayFocus(event, overlay) {
    const focusable = Array.from(overlay.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
