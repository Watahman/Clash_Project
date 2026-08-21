import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { APP_ALIASES, APP_ASSETS } from '../worker/app-routes.js';
import { isExportAssetPath, proxyExportAsset } from '../worker/export-assets.js';

const root = resolve(process.env.STATIC_ROOT || 'src');
const port = Number(process.env.STATIC_PORT || 5173);
const apiTarget = new URL(process.env.DEV_API_TARGET || 'http://localhost:8080');
const mimeTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webp', 'image/webp'],
    ['.avif', 'image/avif'],
    ['.txt', 'text/plain; charset=utf-8'],
    ['.xml', 'application/xml; charset=utf-8']
]);

function proxyApi(request, response) {
    const incoming = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const target = new URL(apiTarget);
    target.pathname = `${apiTarget.pathname.replace(/\/$/, '')}${incoming.pathname.slice(4) || '/'}`;
    target.search = incoming.search;
    const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const headers = { ...request.headers, host: target.host };
    const proxied = send(target, { method: request.method, headers }, upstream => {
        response.writeHead(upstream.statusCode || 502, upstream.headers);
        upstream.pipe(response);
    });
    proxied.on('error', error => {
        response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: `API proxy unavailable: ${error.message}` }));
    });
    request.pipe(proxied);
}

async function proxyExportAssetLocally(request, response) {
    try {
        const incoming = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        const assetResponse = await proxyExportAsset(new Request(incoming, {
            method: request.method,
            headers: request.headers
        }), incoming);
        response.writeHead(assetResponse.status, Object.fromEntries(assetResponse.headers.entries()));
        if (!assetResponse.body || request.method === 'HEAD') response.end();
        else Readable.fromWeb(assetResponse.body).pipe(response);
    } catch {
        response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ error: 'Clan badge proxy unavailable.' }));
    }
}

async function serveFile(request, response) {
    if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
        response.writeHead(405, { Allow: 'GET, HEAD' });
        response.end();
        return;
    }

    const incoming = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    let pathname;
    try {
        pathname = decodeURIComponent(incoming.pathname);
    } catch {
        response.writeHead(400);
        response.end('Bad request');
        return;
    }
    const canonical = APP_ALIASES.get(pathname) || pathname;
    const mapped = APP_ASSETS.get(canonical) || canonical;
    const requested = resolve(root, `.${mapped === '/' ? '/index.html' : mapped}`);
    if (requested !== root && !requested.startsWith(`${root}${sep}`)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
    }

    try {
        const metadata = await stat(requested);
        const file = metadata.isDirectory() ? resolve(requested, 'index.html') : requested;
        const fileMetadata = metadata.isDirectory() ? await stat(file) : metadata;
        response.writeHead(200, {
            'Content-Type': mimeTypes.get(extname(file).toLowerCase()) || 'application/octet-stream',
            'Content-Length': fileMetadata.size,
            'Cache-Control': 'no-cache'
        });
        if (request.method === 'HEAD') response.end();
        else createReadStream(file).pipe(response);
    } catch {
        if (!extname(requested)) {
            try {
                const htmlFile = `${requested}.html`;
                const htmlMetadata = await stat(htmlFile);
                response.writeHead(200, {
                    'Content-Type': mimeTypes.get('.html'),
                    'Content-Length': htmlMetadata.size,
                    'Cache-Control': 'no-cache'
                });
                if (request.method === 'HEAD') response.end();
                else createReadStream(htmlFile).pipe(response);
                return;
            } catch {}
        }
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
    }
}

createServer((request, response) => {
    const incoming = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (isExportAssetPath(incoming.pathname)) void proxyExportAssetLocally(request, response);
    else if (request.url === '/api' || request.url?.startsWith('/api/')) proxyApi(request, response);
    else void serveFile(request, response);
}).listen(port, () => {
    console.log(`Static frontend available at http://localhost:${port}`);
    console.log(`Proxying /api to ${apiTarget.origin}`);
});
