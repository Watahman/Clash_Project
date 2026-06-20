import { withGlobalLoading } from "../utils/loading-state.js";
import { getCachedThenRefresh } from "../cache/local-cache.js";

export async function fetchClashAPIRequest(path, body, cacheOptions = null) {
    const request = async () => {
        const response = await fetch(path, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: body
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    };

    return withGlobalLoading(async () => {
        if (!cacheOptions?.key) return request();
        return getCachedThenRefresh(cacheOptions.key, request, {
            ttlMs: cacheOptions.ttlMs,
            staleMs: cacheOptions.staleMs,
            source: 'clash'
        });
    }, "Laden...");
}
