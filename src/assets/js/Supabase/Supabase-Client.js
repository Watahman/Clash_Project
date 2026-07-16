import { getCachedThenRefresh } from "../cache/local-cache.js";
import { requestJson } from "../utils/request-json.js";

export async function databaseRequestWithBody(path, body, cacheOptions = null, requestOptions = {}) {
    const request = () => requestJson(path, {
        body,
        auth: requestOptions.auth !== false,
        signal: requestOptions.signal,
        loading: requestOptions.loading || 'background',
        loadingMessage: requestOptions.loadingMessage
    });

    if (!cacheOptions?.key) return request();
    return getCachedThenRefresh(cacheOptions.key, request, {
        ttlMs: cacheOptions.ttlMs,
        staleMs: cacheOptions.staleMs,
        maxFallbackAgeMs: cacheOptions.maxFallbackAgeMs,
        source: 'supabase'
    });
}
