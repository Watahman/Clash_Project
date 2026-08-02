const MAX_EVENTS_PER_SESSION = 3;
let sentEvents = 0;

function cleanText(value, maxLength = 500) {
    return String(value || '')
        .replace(/[?&](?:token|code|key|email)=[^&\s]+/gi, '?redacted')
        .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
        .slice(0, maxLength);
}

function report(payload) {
    if (sentEvents >= MAX_EVENTS_PER_SESSION) return;
    sentEvents += 1;
    const body = JSON.stringify({
        ...payload,
        pagePath: location.pathname,
        message: cleanText(payload.message),
        source: cleanText(payload.source, 300)
    });
    const endpoint = `${String(window.APP_CONFIG?.API_BASE_URL || '/api').replace(/\/+$/, '')}/ClientError`;
    if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    } else {
        void fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    }
}

window.addEventListener('error', event => report({
    kind: 'error',
    message: event.message || event.error?.name || 'Unhandled browser error',
    source: event.filename,
    line: event.lineno,
    column: event.colno
}));

window.addEventListener('unhandledrejection', event => report({
    kind: 'promise',
    message: event.reason?.message || event.reason?.name || 'Unhandled promise rejection'
}));
