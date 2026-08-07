const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const PERMANENT_REDIRECT_STATUS = 301;
const CANONICAL_HOST = "clashpanel.com";

const PUBLIC_REDIRECTS = new Map([
    ["/cwl-planner.html", "/cwl-planner"],
    ["/cwl-tracker.html", "/cwl-tracker"],
    ["/clan-management.html", "/clan-management"],
    ["/bracket-generator.html", "/bracket-generator"],
    ["/guides.html", "/guides"],
    ["/methodology.html", "/methodology"],
    ["/changelog.html", "/changelog"],
    ["/subpages/cwl-planner", "/cwl-planner"],
    ["/subpages/cwl-planner.html", "/cwl-planner"],
    ["/subpages/cwl-operation-board", "/cwl-tracker"],
    ["/subpages/cwl-operation-board.html", "/cwl-tracker"],
    ["/subpages/groups", "/clan-management"],
    ["/subpages/groups.html", "/clan-management"],
    ["/subpages/bracket-generator", "/bracket-generator"],
    ["/subpages/bracket-generator.html", "/bracket-generator"],
    ["/subpages/privacy.html", "/subpages/privacy"],
    ["/subpages/cookies.html", "/subpages/cookies"],
    ["/subpages/terms.html", "/subpages/terms"],
    ["/subpages/contact.html", "/subpages/contact"],
    ["/subpages/dashboard", "/dashboard"],
    ["/subpages/dashboard.html", "/dashboard"],
    ["/subpages/cwl-planner-drafts", "/app/cwl-planner-drafts"],
    ["/subpages/cwl-planner-drafts.html", "/app/cwl-planner-drafts"],
    ["/subpages/achievements", "/app/achievements"],
    ["/subpages/achievements.html", "/app/achievements"],
    ["/subpages/advanced-stats", "/app/advanced-stats"],
    ["/subpages/advanced-stats.html", "/app/advanced-stats"]
]);

const APP_ASSETS = new Map([
    ["/dashboard", "/subpages/dashboard"],
    ["/app/cwl-planner", "/subpages/cwl-planner"],
    ["/app/cwl-planner-drafts", "/subpages/cwl-planner-drafts"],
    ["/app/cwl-tracker", "/subpages/cwl-operation-board"],
    ["/app/clan-management", "/subpages/groups"],
    ["/app/war-operation-board", "/subpages/war-operation-board"],
    ["/app/achievements", "/subpages/achievements"],
    ["/app/advanced-stats", "/subpages/advanced-stats"]
]);

const APP_ALIASES = new Map([
    ["/dashboard.html", "/dashboard"],
    ["/app/dashboard", "/dashboard"],
    ["/app/dashboard.html", "/dashboard"],
    ["/app/cwl-planner.html", "/app/cwl-planner"],
    ["/app/cwl-planner-drafts.html", "/app/cwl-planner-drafts"],
    ["/app/cwl-operation-board", "/app/cwl-tracker"],
    ["/app/cwl-operation-board.html", "/app/cwl-tracker"],
    ["/app/cwl-tracker.html", "/app/cwl-tracker"],
    ["/app/groups", "/app/clan-management"],
    ["/app/groups.html", "/app/clan-management"],
    ["/app/clan-management.html", "/app/clan-management"],
    ["/app/war-operation-board.html", "/app/war-operation-board"],
    ["/app/achievements.html", "/app/achievements"],
    ["/app/advanced-stats.html", "/app/advanced-stats"]
]);

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

function normalizedPath(pathname) {
    const normalized = pathname.replace(/\/+$/, "") || "/";
    return normalized.toLowerCase();
}

function permanentRedirect(requestUrl, destination) {
    const redirectUrl = new URL(destination, requestUrl);
    redirectUrl.search = requestUrl.search;
    return Response.redirect(redirectUrl.toString(), PERMANENT_REDIRECT_STATUS);
}

function canonicalOriginRedirect(incomingUrl, canonicalPath = null) {
    if (incomingUrl.protocol === "https:" && incomingUrl.hostname === CANONICAL_HOST) return null;
    const canonicalUrl = new URL(incomingUrl);
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = CANONICAL_HOST;
    if (canonicalPath) canonicalUrl.pathname = canonicalPath;
    return Response.redirect(canonicalUrl.toString(), PERMANENT_REDIRECT_STATUS);
}

function routeRedirect(incomingUrl) {
    const path = normalizedPath(incomingUrl.pathname);
    const canonical = PUBLIC_REDIRECTS.get(path) || APP_ALIASES.get(path);
    if (canonical) return canonical;

    for (const publicPath of [
        "/cwl-planner",
        "/cwl-tracker",
        "/clan-management",
        "/bracket-generator",
        "/guides",
        "/methodology",
        "/changelog"
    ]) {
        if (path === publicPath && incomingUrl.pathname !== publicPath) {
            return publicPath;
        }
    }
    return null;
}

async function serveAppAsset(request, env, incomingUrl) {
    const path = normalizedPath(incomingUrl.pathname);
    const assetPath = APP_ASSETS.get(path);
    if (!assetPath) return null;

    const assetUrl = new URL(incomingUrl);
    assetUrl.pathname = assetPath;
    const assetRequest = new Request(assetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        redirect: "manual"
    });
    const response = await env.ASSETS.fetch(assetRequest);
    const headers = new Headers(response.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
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

async function checkBackendHealth(env) {
    if (!env.CLOUD_RUN_ORIGIN) throw new Error('CLOUD_RUN_ORIGIN is not configured');
    const origin = new URL(env.CLOUD_RUN_ORIGIN);
    const checks = await Promise.all(['/health', '/ready'].map(async path => {
        const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error(`${path} returned ${response.status}`);
        return path;
    }));
    console.log(`Backend health checks passed: ${checks.join(', ')}`);
}

export default {
    async fetch(request, env) {
        const incomingUrl = new URL(request.url);
        const redirect = routeRedirect(incomingUrl);
        const originRedirect = canonicalOriginRedirect(incomingUrl, redirect);
        if (originRedirect) return originRedirect;
        if (isApiPath(incomingUrl.pathname)) {
            return proxyApiRequest(request, env, incomingUrl);
        }
        if (redirect) return permanentRedirect(incomingUrl, redirect);

        const appResponse = await serveAppAsset(request, env, incomingUrl);
        if (appResponse) return appResponse;

        return env.ASSETS.fetch(request);
    },
    scheduled(_controller, env, ctx) {
        ctx.waitUntil(checkBackendHealth(env));
    }
};