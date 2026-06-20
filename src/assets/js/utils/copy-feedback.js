export function initCopyFeedback({ trigger, copyIcon, checkIcon, getText, onCopied, timeout = 1800 }) {
    if (!trigger || !copyIcon || !checkIcon || typeof getText !== 'function') return;

    let timer;
    showCopyIcon(copyIcon, checkIcon);

    trigger.addEventListener('click', () => {
        const text = getText();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            showCheckIcon(copyIcon, checkIcon);
            if (typeof onCopied === 'function') onCopied();
            clearTimeout(timer);
            timer = setTimeout(() => showCopyIcon(copyIcon, checkIcon), timeout);
        });
    });
}

export function showCopyIcon(copyIcon, checkIcon) {
    copyIcon.classList.remove('hidden');
    checkIcon.classList.add('hidden');
}

export function showCheckIcon(copyIcon, checkIcon) {
    checkIcon.classList.remove('hidden');
    copyIcon.classList.add('hidden');
}
