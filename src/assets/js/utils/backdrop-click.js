export function bindBackdropClick(backdrop, onClose) {
    if (!backdrop || typeof onClose !== 'function') return;

    let startedOnBackdrop = false;

    backdrop.addEventListener('pointerdown', event => {
        startedOnBackdrop = event.target === backdrop && event.button === 0;
    });

    backdrop.addEventListener('pointercancel', () => {
        startedOnBackdrop = false;
    });

    backdrop.addEventListener('click', event => {
        const shouldClose = startedOnBackdrop && event.target === backdrop;
        startedOnBackdrop = false;
        if (shouldClose) onClose();
    });
}
