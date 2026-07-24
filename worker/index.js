export default {
    async fetch(request, env) {
        const incomingUrl = new URL(request.url);

        if (
            incomingUrl.pathname === "/api" ||
            incomingUrl.pathname.startsWith("/api/")
        ) {
            if (!env.CLOUD_RUN_ORIGIN) {
                return Response.json(
                    { error: "CLOUD_RUN_ORIGIN ontbreekt" },
                    { status: 500 }
                );
            }

            const backendPath =
                incomingUrl.pathname.slice("/api".length) || "/";

            const targetUrl = new URL(backendPath, env.CLOUD_RUN_ORIGIN);
            targetUrl.search = incomingUrl.search;

            const headers = new Headers(request.headers);
            headers.delete("host");
            headers.set("X-Forwarded-Host", incomingUrl.host);
            headers.set("X-Forwarded-Proto", "https");

            return fetch(targetUrl.toString(), {
                method: request.method,
                headers,
                body:
                    request.method === "GET" || request.method === "HEAD"
                        ? undefined
                        : request.body,
                redirect: "manual"
            });
        }

        return env.ASSETS.fetch(request);
    }
};