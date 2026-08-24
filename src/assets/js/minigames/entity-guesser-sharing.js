export async function shareEntityResult(value) {
    try {
        if (navigator.share) await navigator.share({ text: value });
        else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
        return { copied: true, value };
    } catch (error) {
        return {
            copied: false,
            aborted: error?.name === 'AbortError',
            value
        };
    }
}
