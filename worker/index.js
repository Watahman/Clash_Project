const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function jsonError(status, code, error) {
    return new Response(JSON.stringify({ error, code }), {
        status,
        headers: {
            "Content-Type": JSON_CONTENT_TYPE,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        }
    });
}

function isApiPath(pathname) {
    return pathname === "/api" || pathname.startsWith("/api/");
}

function createBackendHeaders(request, incomingUrl, env) {
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("x-forwarded-for");
    headers.delete("x-forwarded-host");
    headers.delete("x-forwarded-proto");
    headers.delete("x-clashpanel-proxy-secret");
    headers.set("X-Forwarded-Host", incomingUrl.host);
    headers.set("X-Forwarded-Proto", incomingUrl.protocol.replace(":", ""));

    const connectingIp = request.headers.get("CF-Connecting-IP");
    if (connectingIp) headers.set("X-Forwarded-For", connectingIp);
    if (env.API_PROXY_SECRET) {
        headers.set("X-ClashPanel-Proxy-Secret", env.API_PROXY_SECRET);
    }

    return headers;
}

async function proxyApiRequest(request, env, incomingUrl) {
    if (!env.CLOUD_RUN_ORIGIN) {
        return jsonError(500, "PROXY_NOT_CONFIGURED", "API proxy is not configured.");
    }

    let targetUrl;
    try {
        const backendOrigin = new URL(env.CLOUD_RUN_ORIGIN);
        if (!["http:", "https:"].includes(backendOrigin.protocol)) throw new Error();
        const backendPath = incomingUrl.pathname.slice("/api".length) || "/";
        targetUrl = new URL(backendPath, backendOrigin);
        targetUrl.search = incomingUrl.search;
    } catch {
        return jsonError(500, "PROXY_NOT_CONFIGURED", "API proxy is not configured.");
    }

    let upstreamResponse;
    try {
        upstreamResponse = await fetch(targetUrl.toString(), {
            method: request.method,
            headers: createBackendHeaders(request, incomingUrl, env),
            body:
                request.method === "GET" || request.method === "HEAD"
                    ? undefined
                    : request.body,
            redirect: "manual"
        });
    } catch {
        return jsonError(502, "API_UNAVAILABLE", "The API is temporarily unavailable.");
    }

    const contentType = upstreamResponse.headers.get("Content-Type") || "";
    if (upstreamResponse.status >= 400 && !contentType.toLowerCase().includes("json")) {
        const code = upstreamResponse.status === 404
            ? "API_ROUTE_NOT_FOUND"
            : "API_UPSTREAM_ERROR";
        const message = upstreamResponse.status === 404
            ? "API route not found."
            : "The API request failed.";
        return jsonError(upstreamResponse.status, code, message);
    }

    return upstreamResponse;
}

export default {
    async fetch(request, env) {
        const incomingUrl = new URL(request.url);
        if (isApiPath(incomingUrl.pathname)) {
            return proxyApiRequest(request, env, incomingUrl);
        }
        return env.ASSETS.fetch(request);
    }
};
