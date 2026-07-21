export function initCopyFeedback({ trigger, copyIcon, checkIcon, getText, onCopied, timeout = 1800 }) {
    if (!trigger || !copyIcon || !checkIcon || typeof getText !== 'function') return;

    let timer;
    showCopyIcon(copyIcon, checkIcon, trigger);

    trigger.addEventListener('click', async () => {
        const text = getText();
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            showCheckIcon(copyIcon, checkIcon, trigger);
            if (typeof onCopied === 'function') onCopied();

            clearTimeout(timer);
            timer = window.setTimeout(
                () => showCopyIcon(copyIcon, checkIcon, trigger),
                timeout
            );
        } catch (error) {
            showCopyIcon(copyIcon, checkIcon, trigger);
            console.error('Kopiëren naar het klembord is mislukt.', error);
        }
    });
}

export function showCopyIcon(copyIcon, checkIcon, trigger) {
    setIconVisibility(copyIcon, true);
    setIconVisibility(checkIcon, false);
    checkIcon.classList.remove('is-copy-feedback-active');
    if (trigger) trigger.dataset.copyState = 'idle';
}

export function showCheckIcon(copyIcon, checkIcon, trigger) {
    setIconVisibility(copyIcon, false);
    setIconVisibility(checkIcon, true);

    checkIcon.classList.remove('is-copy-feedback-active');
    void checkIcon.offsetWidth;
    checkIcon.classList.add('is-copy-feedback-active');

    if (trigger) trigger.dataset.copyState = 'copied';
}

function setIconVisibility(icon, visible) {
    icon.hidden = !visible;
    icon.classList.toggle('hidden', !visible);
    icon.setAttribute('aria-hidden', visible ? 'false' : 'true');

    icon.style.setProperty('display', visible ? 'block' : 'none', 'important');
}
