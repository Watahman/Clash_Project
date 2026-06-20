import { withGlobalLoading } from "../utils/loading-state.js";
import { getCachedThenRefresh } from "../cache/local-cache.js";

export async function databaseRequestWithBody(path, body, cacheOptions = null) {
    const request = async () => {
        const response = await fetch(path, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const text = await response.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { error: text || "Ongeldig JSON-antwoord" };
        }

        if (!response.ok) {
            const message = data?.error || `Request mislukt (${response.status})`;
            throw new Error(message);
        }

        return data;
    };

    return withGlobalLoading(async () => {
        if (!cacheOptions?.key) return request();
        return getCachedThenRefresh(cacheOptions.key, request, {
            ttlMs: cacheOptions.ttlMs,
            staleMs: cacheOptions.staleMs,
            source: 'supabase'
        });
    }, "Laden...");
}
