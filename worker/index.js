export default {
    async fetch(request, env) {
        const incomingUrl = new URL(request.url);

        // Backendrequests naar Google Cloud Run.
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
                incomingUrl.pathname.substring("/api".length) || "/";

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
                    request.method === "GET" ||
                    request.method === "HEAD"
                        ? undefined
                        : request.body,
                redirect: "manual"
            });
        }

        // Oude lowercase/clean URLs naar het echte bestand redirecten.
        if (
            incomingUrl.pathname === "/subpages" ||
            incomingUrl.pathname.startsWith("/subpages/")
        ) {
            let remainder = incomingUrl.pathname.slice("/subpages".length);

            // Herstel foutieve dubbele paden zoals:
            // /subpages/subPages/dashboard.html
            remainder = remainder.replace(/^\/subPages(?=\/|$)/, "");

            // Herstel de echte hoofdletters van deze map.
            remainder = remainder.replace(
                /^\/popup_htmls(?=\/|$)/i,
                "/popup_HTMLs"
            );

            if (!remainder || remainder === "/") {
                remainder = "/dashboard.html";
            }

            const finalPart = remainder.split("/").pop() || "";

            if (!finalPart.includes(".")) {
                remainder += ".html";
            }

            const canonicalUrl = new URL(request.url);
            canonicalUrl.pathname = `/subPages${remainder}`;

            // Tijdelijke redirect tijdens het testen.
            return Response.redirect(canonicalUrl.toString(), 302);
        }

        return env.ASSETS.fetch(request);
    }
};