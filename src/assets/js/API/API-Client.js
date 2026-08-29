import { getCachedThenRefresh } from "../cache/local-cache.js?v=20260829-public-auth-v1";
import { requestJson } from "../utils/request-json.js?v=20260829-public-auth-v1";

export async function fetchClashAPIRequest(path, body, cacheOptions = null, requestOptions = {}) {
    const forceRefresh = requestOptions.forceRefresh === true;
    const request = () => requestJson(path, {
        body,
        headers: forceRefresh ? { 'Cache-Control': 'no-cache' } : undefined,
        signal: requestOptions.signal,
        loading: requestOptions.loading || 'background',
        loadingMessage: requestOptions.loadingMessage
    });

    if (!cacheOptions?.key) return request();
    return getCachedThenRefresh(cacheOptions.key, request, {
        ttlMs: cacheOptions.ttlMs,
        staleMs: cacheOptions.staleMs,
        maxFallbackAgeMs: cacheOptions.maxFallbackAgeMs,
        forceRefresh,
        onRefresh: requestOptions.onRefresh,
        onRefreshError: requestOptions.onRefreshError,
        source: 'clash'
    });
}
