export function copyWithFeedback(text, iconCopy, iconCheck, durationMs = 1800) {
    navigator.clipboard.writeText(text).catch(() => {});
    iconCopy.classList.add('po-hidden');
    iconCheck.classList.remove('po-hidden');
    clearTimeout(copyWithFeedback._timer);
    copyWithFeedback._timer = setTimeout(() => {
        iconCopy.classList.remove('po-hidden');
        iconCheck.classList.add('po-hidden');
    }, durationMs);
}
