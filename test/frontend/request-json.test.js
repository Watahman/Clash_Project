import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => ({
    getAccessToken: vi.fn().mockResolvedValue('test-token')
}));

import { HttpError, requestJson } from '../../src/assets/js/utils/request-json.js?v=20260829-public-auth-v1';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('central JSON request errors', () => {
    it('preserves safe backend status, code and details', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ error: 'Te veel aanvragen', code: 'RATE_LIMITED' }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }
        )));

        const error = await requestJson('/test', { body: {} }).catch(value => value);
        expect(error).toBeInstanceOf(HttpError);
        expect(error).toMatchObject({
            message: 'Te veel aanvragen',
            status: 429,
            code: 'RATE_LIMITED',
            details: { error: 'Te veel aanvragen', code: 'RATE_LIMITED', retryAfter: 30 }
        });
    });

    it('distinguishes an unreachable backend from an HTTP error', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')));
        await expect(requestJson('/test', { body: {} })).rejects.toMatchObject({
            status: 0,
            code: 'NETWORK_ERROR'
        });
    });

    it('rejects invalid JSON returned with a successful status', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })));
        await expect(requestJson('/test')).rejects.toMatchObject({
            status: 200,
            message: 'The server returned an invalid response.'
        });
    });

    it('only emits session expiry for a session-bound 401', async () => {
        const expired = vi.fn();
        window.addEventListener('clashtools:auth-session-expired', expired);
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('', { status: 401 }))));

        await expect(requestJson('/public')).rejects.toMatchObject({
            status: 401,
            sessionBound: false
        });
        expect(expired).not.toHaveBeenCalled();

        await expect(requestJson('/private', { sessionBound: true })).rejects.toMatchObject({
            status: 401,
            sessionBound: true
        });
        expect(expired).toHaveBeenCalledTimes(1);
        window.removeEventListener('clashtools:auth-session-expired', expired);
    });

    it('aborts a request that exceeds the configured timeout', async () => {
        vi.stubGlobal('fetch', vi.fn((url, options) => new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
        })));

        await expect(requestJson('/test', { timeoutMs: 5 })).rejects.toMatchObject({
            status: 0,
            code: 'REQUEST_TIMEOUT'
        });
    });
});
