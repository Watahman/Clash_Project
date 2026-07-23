import { withGlobalLoading } from './loading-state.js';

export class HttpError extends Error {
    constructor(message, { status = 0, code = '', details = null } = {}) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

async function parseResponse(response) {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        if (response.ok) throw new HttpError('De server gaf een ongeldig antwoord.', { status: response.status });
        return { error: 'De server gaf een ongeldig antwoord.' };
    }
}

function timedSignal(parentSignal, timeoutMs) {
    const milliseconds = Number(timeoutMs);
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
        return { signal: parentSignal, timedOut: () => false, cleanup: () => {} };
    }

    const controller = new AbortController();
    let didTimeOut = false;
    const forwardAbort = () => controller.abort();
    if (parentSignal?.aborted) forwardAbort();
    else parentSignal?.addEventListener('abort', forwardAbort, { once: true });

    const timer = globalThis.setTimeout(() => {
        didTimeOut = true;
        controller.abort();
    }, milliseconds);

    return {
        signal: controller.signal,
        timedOut: () => didTimeOut,
        cleanup: () => {
            globalThis.clearTimeout(timer);
            parentSignal?.removeEventListener('abort', forwardAbort);
        }
    };
}

export async function requestJson(url, {
    method = 'POST',
    body,
    headers = {},
    signal,
    timeoutMs = 20_000,
    loading = 'background',
    loadingMessage = 'Laden...'
} = {}) {
    const execute = async () => {
        const requestHeaders = {
            Accept: 'application/json',
            ...headers
        };
        if (body !== undefined) requestHeaders['Content-Type'] ||= 'application/json';

        let response;
        const requestSignal = timedSignal(signal, timeoutMs);
        try {
            response = await fetch(url, {
                method,
                headers: requestHeaders,
                body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
                signal: requestSignal.signal,
                credentials: 'include'
            });
        } catch (error) {
            if (requestSignal.timedOut()) {
                throw new HttpError('De server antwoordde niet op tijd. Probeer opnieuw.', {
                    code: 'REQUEST_TIMEOUT'
                });
            }
            if (error?.name === 'AbortError') throw error;
            throw new HttpError('De server is niet bereikbaar. Controleer je verbinding en probeer opnieuw.', {
                code: 'NETWORK_ERROR',
                details: error
            });
        } finally {
            requestSignal.cleanup();
        }

        const data = await parseResponse(response);
        if (!response.ok) {
            throw new HttpError(
                data?.error || data?.message || `Request mislukt (${response.status})`,
                { status: response.status, code: data?.code || '', details: data }
            );
        }
        return data;
    };

    return loading === 'blocking'
        ? withGlobalLoading(execute, loadingMessage)
        : execute();
}
