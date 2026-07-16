import { getAccessToken } from '../auth/auth-client.js';
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

export async function requestJson(url, {
    method = 'POST',
    body,
    headers = {},
    signal,
    auth = false,
    loading = 'background',
    loadingMessage = 'Laden...'
} = {}) {
    const execute = async () => {
        const requestHeaders = {
            Accept: 'application/json',
            ...headers
        };
        if (body !== undefined) requestHeaders['Content-Type'] ||= 'application/json';
        if (auth) {
            const token = await getAccessToken();
            if (!token) throw new HttpError('Je sessie is verlopen. Log opnieuw in.', { status: 401, code: 'AUTH_REQUIRED' });
            requestHeaders.Authorization = `Bearer ${token}`;
        }

        let response;
        try {
            response = await fetch(url, {
                method,
                headers: requestHeaders,
                body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
                signal
            });
        } catch (error) {
            if (error?.name === 'AbortError') throw error;
            throw new HttpError('De server is niet bereikbaar. Controleer je verbinding en probeer opnieuw.', {
                code: 'NETWORK_ERROR',
                details: error
            });
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
