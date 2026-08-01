import { withGlobalLoading } from './loading-state.js';
import { t } from '../i18n/i18n.js';

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
        if (response.ok) throw new HttpError(t('errors.invalidServerResponse'), { status: response.status });
        return { error: t('errors.invalidServerResponse') };
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
    loadingMessage = t('common.loading')
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
                throw new HttpError(t('errors.requestTimeout'), {
                    code: 'REQUEST_TIMEOUT'
                });
            }
            if (error?.name === 'AbortError') throw error;
            throw new HttpError(t('errors.network'), {
                code: 'NETWORK_ERROR',
                details: error
            });
        } finally {
            requestSignal.cleanup();
        }

        const data = await parseResponse(response);
        if (!response.ok) {
            const retryAfterSeconds = Number(response.headers.get('Retry-After'));
            let details = data;
            if (response.status === 429 && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
                details = data && typeof data === 'object' && !Array.isArray(data)
                    ? { ...data, retryAfter: retryAfterSeconds }
                    : { retryAfter: retryAfterSeconds };
            }
            throw new HttpError(
                data?.error || data?.message || t('errors.requestFailed', { status: response.status }),
                { status: response.status, code: data?.code || '', details }
            );
        }
        return data;
    };

    return loading === 'blocking'
        ? withGlobalLoading(execute, loadingMessage)
        : execute();
}
