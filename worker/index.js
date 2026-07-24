export default {
    async fetch(request, env) {
        const incomingUrl = new URL(request.url);

        // Alles onder /api doorsturen naar Google Cloud Run.
        if (incomingUrl.pathname.startsWith("/api/")) {
            if (!env.CLOUD_RUN_ORIGIN) {
                return Response.json(
                    { error: "CLOUD_RUN_ORIGIN ontbreekt" },
                    { status: 500 }
                );
            }

            // /api/health wordt /health op Cloud Run.
            const backendPath =
                incomingUrl.pathname.substring("/api".length) || "/";

            const targetUrl = new URL(backendPath, env.CLOUD_RUN_ORIGIN);
            targetUrl.search = incomingUrl.search;

            const headers = new Headers(request.headers);
            headers.delete("host");
            headers.set("X-Forwarded-Host", incomingUrl.host);
            headers.set("X-Forwarded-Proto", "https");

            try {
                return await fetch(targetUrl.toString(), {
                    method: request.method,
                    headers,
                    body:
                        request.method === "GET" || request.method === "HEAD"
                            ? undefined
                            : request.body,
                    redirect: "manual"
                });
            } catch (error) {
                console.error("Cloud Run proxy error:", error);

                return Response.json(
                    { error: "Cloud Run is niet bereikbaar" },
                    { status: 502 }
                );
            }
        }

        // Alle andere aanvragen blijven gewone frontendbestanden.
        return env.ASSETS.fetch(request);
    }
};