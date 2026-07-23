import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/auth/auth-client.js', () => ({
    getAccessToken: vi.fn().mockResolvedValue('test-token')
}));

import { HttpError, requestJson } from '../../src/assets/js/utils/request-json.js';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('central JSON request errors', () => {
    it('preserves safe backend status, code and details', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ error: 'Te veel aanvragen', code: 'RATE_LIMITED', retryAfter: 30 }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
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
            message: 'De server gaf een ongeldig antwoord.'
        });
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
