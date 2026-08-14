(() => {
    'use strict';

    const html = document.documentElement;
    const PAGE_PATHS = [
        '/dashboard',
        '/app/explore',
        '/app/cwl-planner',
        '/app/cwl-planner-drafts',
        '/app/cwl-tracker',
        '/app/war-board',
        '/app/brackets',
        '/app/minigames',
        '/app/clan-management'
    ];

    const INITIAL_VISUAL_TIMEOUT_MS = 1800;
    const INITIAL_CONTENT_TIMEOUT_MS = 12000;
    const NAVIGATION_VISUAL_TIMEOUT_MS = 3200;
    const NAVIGATION_SPINNER_DELAY_MS = 140;

    const preloadedPages = new Map();
    const prefetchedAssets = new Map();
    const initialLoadTasks = [];
    const originalFetch = window.fetch.bind(window);

    let pageRevealed = false;
    let productFontsScheduled = false;

    applyStoredThemeImmediately();
    installNavigationPreloading();

    window.clashtoolsRegisterInitialLoad = task => {
        const promise = Promise.resolve(task);
        initialLoadTasks.push(promise);
        return promise;
    };

    void revealWhenVisualsAreReady();

    // Never leave the application hidden indefinitely when a request stalls.
    window.setTimeout(revealPage, INITIAL_CONTENT_TIMEOUT_MS + 500);

    function applyStoredThemeImmediately() {
        try {
            let theme = localStorage.getItem('clashtools_theme');
            if (theme === 'system') {
                theme = window.matchMedia?.('(prefers-color-scheme: light)').matches
                    ? 'light'
                    : 'dark';
                localStorage.setItem('clashtools_theme', theme);
            }
            if (theme === 'light' || theme === 'dark') {
                html.dataset.theme = theme;
            }
        } catch {
            // The normal theme module still initializes the theme later.
        }
    }

    async function revealWhenVisualsAreReady() {
        // Public HTML is already meaningful without JavaScript. Reveal it before
        // DOMContentLoaded so large translations or session checks cannot delay FCP.
        if (html.classList.contains('public-page')) {
            await nextPaint();
            revealPage();
            return;
        }

        await domReady();

        // Backward-compatible fallback for public pages without the HTML marker.
        if (document.body?.classList.contains('public-site')) {
            await nextPaint();
            revealPage();
            return;
        }

        await Promise.allSettled([
            Promise.race([
                Promise.allSettled([
                    waitForStylesheets(),
                    waitForFonts(),
                    waitForInitialImages()
                ]),
                delay(INITIAL_VISUAL_TIMEOUT_MS)
            ]),
            Promise.race([
                Promise.allSettled(initialLoadTasks),
                delay(INITIAL_CONTENT_TIMEOUT_MS)
            ])
        ]);

        await nextPaint();
        revealPage();
    }

    function domReady() {
        if (document.readyState !== 'loading') return Promise.resolve();
        return new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        });
    }

    function waitForStylesheets() {
        const stylesheets = Array.from(
            document.querySelectorAll('link[rel~="stylesheet"][href]')
        );

        return Promise.allSettled(stylesheets.map(link => {
            if (link.sheet) return Promise.resolve();

            return new Promise(resolve => {
                const finish = () => resolve();
                link.addEventListener('load', finish, { once: true });
                link.addEventListener('error', finish, { once: true });
                window.setTimeout(finish, 1100);
            });
        }));
    }

    function waitForFonts() {
        if (!document.fonts?.ready) return Promise.resolve();
        return Promise.race([
            document.fonts.ready.catch(() => undefined),
            delay(700)
        ]);
    }

    function waitForInitialImages() {
        const selectors = [
            'body > header img[src]',
            '.workspace-sidebar img[src]',
            '.workspace-topbar img[src]',
            'main img[src]:not([loading="lazy"])'
        ];

        const images = Array.from(new Set(
            selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)))
        )).filter(image => !image.complete);

        if (!images.length) return Promise.resolve();

        const imageLoads = Promise.allSettled(images.map(image => new Promise(resolve => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
        })));

        return Promise.race([imageLoads, delay(850)]);
    }

    function revealPage() {
        if (pageRevealed) return;
        pageRevealed = true;
        html.classList.remove('workspace-page-loading');
        html.classList.add('workspace-page-ready');
        window.dispatchEvent(new CustomEvent('clashtools:page-ready'));
        scheduleProductFonts();
        if (document.body?.classList.contains('workspace-app')) {
            scheduleIdlePreload();
        }
    }

    function scheduleProductFonts() {
        if (productFontsScheduled) return;
        productFontsScheduled = true;

        const load = () => {
            if (document.querySelector('link[data-clashtools-fonts]')) return;
            const stylesheet = document.createElement('link');
            stylesheet.rel = 'stylesheet';
            stylesheet.dataset.clashtoolsFonts = 'true';
            stylesheet.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Manrope:wght@500;600;700;800&family=Rajdhani:wght@500;600;700&display=optional';
            document.head.append(stylesheet);
        };
        const loadWhenIdle = () => {
            if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 1200 });
            else window.setTimeout(load, 250);
        };

        if (document.readyState === 'complete') loadWhenIdle();
        else window.addEventListener('load', loadWhenIdle, { once: true });
    }

    function installNavigationPreloading() {
        const candidateFromEvent = event => {
            const anchor = event.target?.closest?.('a[href]');
            if (!anchor) return null;
            const url = toWorkspaceUrl(anchor.href);
            return url ? { anchor, url } : null;
        };

        ['pointerover', 'focusin', 'touchstart'].forEach(type => {
            document.addEventListener(type, event => {
                const candidate = candidateFromEvent(event);
                if (candidate) void preloadWorkspaceVisuals(candidate.url);
            }, { passive: true });
        });

        document.addEventListener('click', event => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const candidate = candidateFromEvent(event);
            if (!candidate) return;
            if (candidate.anchor.target && candidate.anchor.target !== '_self') return;
            if (candidate.anchor.hasAttribute('download')) return;

            event.preventDefault();

            let spinnerVisible = false;
            const spinnerTimer = window.setTimeout(() => {
                spinnerVisible = true;
                html.classList.add('workspace-navigation-waiting');
            }, NAVIGATION_SPINNER_DELAY_MS);

            Promise.race([
                preloadWorkspaceVisuals(candidate.url),
                delay(NAVIGATION_VISUAL_TIMEOUT_MS)
            ]).catch(() => null).finally(() => {
                window.clearTimeout(spinnerTimer);
                if (spinnerVisible) html.classList.remove('workspace-navigation-waiting');
                window.location.assign(candidate.url.href);
            });
        });
    }

    function scheduleIdlePreload() {
        const run = () => {
            workspacePageUrls().forEach(url => {
                if (url.pathname !== window.location.pathname) {
                    void preloadWorkspaceVisuals(url);
                }
            });
            void preloadProfileMarkup();
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(run, { timeout: 1200 });
        } else {
            window.setTimeout(run, 180);
        }
    }

    function workspacePageUrls() {
        return PAGE_PATHS.map(path =>
            new URL(path, window.location.origin)
        );
    }

    function profileMarkupUrl() {
        return new URL(
            "/subpages/popup_htmls/profile_popup.html",
            window.location.origin
        );
    }

    function toWorkspaceUrl(value) {
        try {
            const url = new URL(value, window.location.href);
            if (url.origin !== window.location.origin) return null;
            if (!PAGE_PATHS.includes(url.pathname.replace(/\/+$/, ''))) {
                return null;
            }
            return url;
        } catch {
            return null;
        }
    }

    function preloadWorkspaceVisuals(url) {
        const key = url.href.split('#')[0];
        if (preloadedPages.has(key)) return preloadedPages.get(key);

        const promise = originalFetch(key, {
            credentials: 'same-origin',
            cache: 'force-cache'
        }).then(async response => {
            if (!response.ok) {
                throw new Error(`Page could not be preloaded (${response.status})`);
            }

            const source = await response.text();
            const pageDocument = new DOMParser().parseFromString(source, 'text/html');
            const stylesheetUrls = collectSameOriginUrls(
                pageDocument.querySelectorAll('link[rel~="stylesheet"][href]'),
                'href',
                key
            );
            const imageUrls = collectSameOriginUrls(
                pageDocument.querySelectorAll('img[src]:not([loading="lazy"])'),
                'src',
                key
            );

            await Promise.allSettled([
                ...stylesheetUrls.map(prefetchCssAsset),
                ...imageUrls.map(prefetchBinaryAsset)
            ]);

            return true;
        }).catch(error => {
            preloadedPages.delete(key);
            throw error;
        });

        preloadedPages.set(key, promise);
        return promise;
    }

    function collectSameOriginUrls(elements, attribute, baseUrl) {
        const urls = new Set();
        elements.forEach(element => {
            const value = element.getAttribute(attribute);
            if (!value) return;
            const url = new URL(value, baseUrl);
            if (url.origin === window.location.origin) urls.add(url.href);
        });
        return Array.from(urls, value => new URL(value));
    }

    async function preloadProfileMarkup() {
        const url = profileMarkupUrl();
        const response = await originalFetch(url.href, {
            credentials: 'same-origin',
            cache: 'force-cache'
        }).catch(() => null);
        if (!response?.ok) return false;

        const source = await response.text();
        const profileDocument = new DOMParser().parseFromString(source, 'text/html');
        const pictureBase = new URL('../../assets/css/pictures/', url);
        const images = new Set();

        profileDocument.querySelectorAll('img[src], img[data-profile-src]').forEach(image => {
            const directSource = image.getAttribute('src');
            const profileSource = image.getAttribute('data-profile-src');
            const asset = directSource
                ? new URL(directSource, url)
                : profileSource
                    ? new URL(profileSource, pictureBase)
                    : null;
            if (asset?.origin === window.location.origin) images.add(asset.href);
        });

        await Promise.allSettled(Array.from(images, value => prefetchBinaryAsset(new URL(value))));
        return true;
    }

    function prefetchCssAsset(url) {
        const key = url.href.split('#')[0];
        if (prefetchedAssets.has(key)) return prefetchedAssets.get(key);

        const promise = originalFetch(key, {
            credentials: 'same-origin',
            cache: 'force-cache'
        }).then(async response => {
            if (!response.ok) return false;
            const source = await response.text();
            const dependencies = findCssDependencies(source, url);
            await Promise.allSettled(dependencies.map(prefetchBinaryAsset));
            return true;
        }).catch(() => false);

        prefetchedAssets.set(key, promise);
        return promise;
    }

    function prefetchBinaryAsset(url) {
        const key = url.href.split('#')[0];
        if (prefetchedAssets.has(key)) return prefetchedAssets.get(key);

        const promise = originalFetch(key, {
            credentials: 'same-origin',
            cache: 'force-cache'
        }).then(response => response.ok).catch(() => false);

        prefetchedAssets.set(key, promise);
        return promise;
    }

    function findCssDependencies(source, baseUrl) {
        const dependencies = new Set();
        const urlExpression = /url\(\s*(['"]?)([^'"\)]+)\1\s*\)/g;
        const importExpression = /@import\s+(?:url\()?\s*(['"])([^'"]+)\1\s*\)?/g;

        const addDependency = specifier => {
            const value = specifier?.trim();
            if (!value || value.startsWith('data:') || value.startsWith('#')) return;
            const dependency = new URL(value, baseUrl);
            if (dependency.origin === window.location.origin) {
                dependencies.add(dependency.href);
            }
        };

        let match;
        while ((match = urlExpression.exec(source))) addDependency(match[2]);
        while ((match = importExpression.exec(source))) addDependency(match[2]);

        return Array.from(dependencies, value => new URL(value));
    }

    function delay(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }

    function nextPaint() {
        return new Promise(resolve => {
            window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
        });
    }
})();
