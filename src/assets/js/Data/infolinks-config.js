/*
 * Account snippet supplied for this site. The script URL uses HTTPS so it can
 * load on ClashPanel's HTTPS pages without mixed content.
 */

const PUBLIC_AD_ELIGIBLE_ROUTES = Object.freeze([
    '/',
    '/cwl-planner',
    '/cwl-tracker',
    '/clan-management',
    '/methodology',
    '/guides',
    '/guides/fair-cwl-roster',
    '/guides/cwl-rotation',
    '/guides/cwl-availability',
    '/guides/missed-attacks',
    '/guides/cwl-attack-defense',
    '/guides/cwl-season-history',
    '/guides/cwl-bonus-medals',
    '/guides/spreadsheet-vs-cwl-planner',
    '/about',
    '/bracket-generator'
]);

const HARD_EXCLUDED_PREFIXES = Object.freeze(['/api', '/app', '/subpages']);

const INFOLINKS_CONFIG = Object.freeze({
    enabled: true,
    script: Object.freeze({
        src: 'https://resources.infolinks.com/js/infolinks_main.js',
        type: 'text/javascript',
        async: true,
        defer: true,
        attributes: Object.freeze({})
    }),
    initialization: Object.freeze({
        globals: Object.freeze({ infolinks_pid: 3447886, infolinks_wsid: 0 })
    })
});

const AD_ELIGIBLE_ROUTES = new Set(PUBLIC_AD_ELIGIBLE_ROUTES);
const GUIDE_ROUTES = new Set(PUBLIC_AD_ELIGIBLE_ROUTES.filter(route => route.startsWith('/guides/')));

export {
    AD_ELIGIBLE_ROUTES,
    GUIDE_ROUTES,
    HARD_EXCLUDED_PREFIXES,
    INFOLINKS_CONFIG,
    PUBLIC_AD_ELIGIBLE_ROUTES
};
