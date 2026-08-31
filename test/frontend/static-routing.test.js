import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer as createTcpServer } from 'node:net';
import { request as httpRequest } from 'node:http';

const host = '127.0.0.1';
let devServer;
let port;

beforeAll(async () => {
    port = await findAvailablePort();
    devServer = spawn(process.execPath, ['scripts/serve-static.mjs'], {
        cwd: process.cwd(),
        env: { ...process.env, STATIC_PORT: String(port), STATIC_ROOT: 'src' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForReady();
});

afterAll(() => {
    if (devServer && !devServer.killed) devServer.kill();
});

describe('local public route handling', () => {
    it.each(['/privacy', '/cookies', '/terms', '/contact'])
    ('serves canonical legal route %s with visible HTML', async route => {
        const response = await get(route);

        expect(response.status).toBe(200);
        expect(response.body).toContain('<html');
        expect(response.body).toContain('data-policy-document');
    });

    it.each([
        ['/privacy/', '/privacy'],
        ['/privacy.html', '/privacy'],
        ['/subpages/privacy', '/privacy'],
        ['/subpages/privacy.html', '/privacy'],
        ['/cookies/', '/cookies'],
        ['/cookies.html', '/cookies'],
        ['/subpages/cookies', '/cookies'],
        ['/subpages/cookies.html', '/cookies'],
        ['/terms/', '/terms'],
        ['/terms.html', '/terms'],
        ['/subpages/terms', '/terms'],
        ['/subpages/terms.html', '/terms'],
        ['/contact/', '/contact'],
        ['/contact.html', '/contact'],
        ['/subpages/contact', '/contact'],
        ['/subpages/contact.html', '/contact']
    ])('canonicalizes %s in one local redirect', async (source, destination) => {
        const response = await get(source);

        expect(response.status).toBe(301);
        expect(response.headers.location).toBe(destination);

        const canonical = await get(destination);
        expect(canonical.status).toBe(200);
        expect(canonical.body).toContain('data-policy-document');
    });
});

function findAvailablePort() {
    return new Promise((resolve, reject) => {
        const server = createTcpServer();
        server.once('error', reject);
        server.listen(0, host, () => {
            const address = server.address();
            const selectedPort = typeof address === 'object' && address ? address.port : 0;
            server.close(error => error ? reject(error) : resolve(selectedPort));
        });
    });
}

async function waitForReady() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        if (devServer.exitCode !== null) throw new Error('Local static server exited early.');
        try {
            if ((await get('/privacy')).status === 200) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('Local static server did not become ready.');
}

function get(pathname) {
    return new Promise((resolve, reject) => {
        const request = httpRequest({ host, port, path: pathname }, response => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve({
                status: response.statusCode,
                headers: response.headers,
                body: Buffer.concat(chunks).toString('utf8')
            }));
        });
        request.once('error', reject);
        request.setTimeout(1000, () => request.destroy(new Error('Request timed out.')));
        request.end();
    });
}
