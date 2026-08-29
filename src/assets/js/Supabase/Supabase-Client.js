import { getCachedThenRefresh } from "../cache/local-cache.js?v=20260829-public-auth-v1";
import { requestJson } from "../utils/request-json.js?v=20260829-public-auth-v1";

export async function databaseRequestWithBody(path, body, cacheOptions = null, requestOptions = {}) {
    const request = () => requestJson(path, {
        body,
        signal: requestOptions.signal,
        loading: requestOptions.loading || 'background',
        loadingMessage: requestOptions.loadingMessage,
        sessionBound: true
    });

    if (!cacheOptions?.key) return request();
    return getCachedThenRefresh(cacheOptions.key, request, {
        ttlMs: cacheOptions.ttlMs,
        staleMs: cacheOptions.staleMs,
        maxFallbackAgeMs: cacheOptions.maxFallbackAgeMs,
        forceRefresh: requestOptions.forceRefresh === true,
        onRefresh: requestOptions.onRefresh,
        onRefreshError: requestOptions.onRefreshError,
        source: 'supabase'
    });
}
