import { getCachedThenRefresh } from "../cache/local-cache.js";
import { requestJson } from "../utils/request-json.js";

export async function fetchClashAPIRequest(path, body, cacheOptions = null, requestOptions = {}) {
    const request = () => requestJson(path, {
        body,
        signal: requestOptions.signal,
        loading: requestOptions.loading || 'background',
        loadingMessage: requestOptions.loadingMessage
    });

    if (!cacheOptions?.key) return request();
    return getCachedThenRefresh(cacheOptions.key, request, {
        ttlMs: cacheOptions.ttlMs,
        staleMs: cacheOptions.staleMs,
        maxFallbackAgeMs: cacheOptions.maxFallbackAgeMs,
        forceRefresh: requestOptions.forceRefresh === true,
        onRefresh: requestOptions.onRefresh,
        onRefreshError: requestOptions.onRefreshError,
        source: 'clash'
    });
}
