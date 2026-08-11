import { APP_ALIASES, APP_ASSETS } from './app-routes.js';

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
    ["/subpages/explore", "/app/explore"],
    ["/subpages/explore.html", "/app/explore"],
    ["/subpages/cwl-planner-drafts", "/app/cwl-planner-drafts"],
    ["/subpages/cwl-planner-drafts.html", "/app/cwl-planner-drafts"],
    ["/subpages/achievements", "/app/achievements"],
    ["/subpages/achievements.html", "/app/achievements"],
    ["/subpages/advanced-stats", "/app/advanced-stats"],
    ["/subpages/advanced-stats.html", "/app/advanced-stats"]
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

function isAdvancedStatsApiPath(pathname) {
    const path = String(pathname || "").toLowerCase();
    return path.startsWith("/api/advancedstats") || path === "/api/internaladvancedstatspoll";
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

function canonicalOriginRedirect(incomingUrl, canonicalPath = null, env = {}) {
    if (String(env.DISABLE_CANONICAL_REDIRECT || "").toLowerCase() === "true") return null;
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

function applyUpstreamOriginOverride(headers, env) {
    const rawOverride = String(env.UPSTREAM_ORIGIN_OVERRIDE || "").trim();
    if (!rawOverride) return;
    try {
        const overrideUrl = new URL(rawOverride);
        if (!["http:", "https:"].includes(overrideUrl.protocol)) return;
        headers.set("Origin", overrideUrl.origin);
        headers.set("Referer", `${overrideUrl.origin}/`);
    } catch {
        // Invalid preview-only override is ignored; production behavior remains unchanged.
    }
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
    applyUpstreamOriginOverride(headers, env);

    const connectingIp = request.headers.get("CF-Connecting-IP");
    if (connectingIp) headers.set("X-Forwarded-For", connectingIp);
    if (env.API_PROXY_SECRET) {
        headers.set("X-ClashPanel-Proxy-Secret", env.API_PROXY_SECRET);
    }

    return headers;
}

function privateApiResponse(response) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("Pragma", "no-cache");
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
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

    if (isAdvancedStatsApiPath(incomingUrl.pathname)) {
        return privateApiResponse(upstreamResponse);
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
        const originRedirect = canonicalOriginRedirect(incomingUrl, redirect, env);
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
