const NATIVE_KEY = 'b6ef4e968b1f1a4390ef24f608b1a36e';
const AD_NETWORK = 'https://www.highrevenueformat.com';
const NATIVE_NETWORK = 'https://pl31261194.profitableratecpmnetwork.com';

const PUBLIC_AD_ELIGIBLE_ROUTES = Object.freeze([
    '/', '/guides', '/guides/fair-cwl-roster', '/guides/cwl-rotation',
    '/guides/cwl-availability', '/guides/missed-attacks',
    '/guides/cwl-attack-defense', '/guides/cwl-season-history',
    '/guides/cwl-bonus-medals', '/guides/spreadsheet-vs-cwl-planner',
    '/methodology', '/cwl-planner', '/cwl-tracker', '/clan-management',
    '/bracket-generator', '/minigames', '/about', '/changelog'
]);
const APP_AD_ELIGIBLE_ROUTES = new Set([
    '/dashboard', '/app/advanced-stats', '/app/achievements',
    '/app/cwl-planner-drafts', '/app/cwl-planner', '/app/cwl-tracker',
    '/app/war-board', '/app/clan-management', '/app/explore',
    '/app/brackets', '/app/minigames'
]);
const AD_ELIGIBLE_ROUTES = new Set([
    ...PUBLIC_AD_ELIGIBLE_ROUTES, ...APP_AD_ELIGIBLE_ROUTES
]);
const HARD_EXCLUDED_PREFIXES = Object.freeze(['/api', '/subpages']);

const AD_UNITS = Object.freeze({
    native: Object.freeze({ type: 'native', key: NATIVE_KEY, containerId: `container-${NATIVE_KEY}`, width: 0, height: 0, src: `${NATIVE_NETWORK}/${NATIVE_KEY}/invoke.js` }),
    'rectangle-300x250': Object.freeze({ type: 'rectangle-300x250', key: '61a6eb16f5ada2c23381e3dc05d609fa', width: 300, height: 250, src: `${AD_NETWORK}/61a6eb16f5ada2c23381e3dc05d609fa/invoke.js` }),
    'mobile-320x50': Object.freeze({ type: 'mobile-320x50', key: 'fb56e6640ae77dbed5cc52a16d8531a4', width: 320, height: 50, src: `${AD_NETWORK}/fb56e6640ae77dbed5cc52a16d8531a4/invoke.js` }),
    'desktop-728x90': Object.freeze({ type: 'desktop-728x90', key: '674c1dce68ef2c0985ffc5aa5ff5ee07', width: 728, height: 90, src: `${AD_NETWORK}/674c1dce68ef2c0985ffc5aa5ff5ee07/invoke.js` })
});
const LABELS = Object.freeze({ en: 'Advertisement', nl: 'Advertentie', fr: 'Publicité', de: 'Werbung', es: 'Publicidad' });
const GUIDE_ROUTES = new Set(PUBLIC_AD_ELIGIBLE_ROUTES.filter(route => route.startsWith('/guides/')));

const PLACEMENTS = Object.freeze({
    '/': [{ id: 'home-horizontal', type: 'responsive-horizontal', after: '.home3-featured' }, { id: 'home-native', type: 'native', after: '.home3-ecosystem' }],
    '/guides': [{ id: 'guides-horizontal', type: 'responsive-horizontal', after: '.resource-hero' }, { id: 'guides-native', type: 'native', after: '.guide-library' }],
    guidesDetail: [{ id: 'guide-detail-horizontal', type: 'responsive-horizontal', after: '.resource-hero' }],
    '/methodology': [{ id: 'methodology-horizontal', type: 'responsive-horizontal', after: '.resource-hero' }, { id: 'methodology-native', type: 'native', after: '#performance' }],
    '/cwl-planner': [{ id: 'planner-horizontal', type: 'responsive-horizontal', after: '.cp-detail-section' }, { id: 'planner-native', type: 'native', after: '.home-v2-products' }],
    '/cwl-tracker': [{ id: 'tracker-horizontal', type: 'responsive-horizontal', after: '.cp-detail-section' }, { id: 'tracker-native', type: 'native', after: '.home-v2-products' }],
    '/clan-management': [{ id: 'clan-horizontal', type: 'responsive-horizontal', after: '.cp-detail-section' }, { id: 'clan-native', type: 'native', after: '.home-v2-products' }],
    '/bracket-generator': [{ id: 'bracket-horizontal', type: 'responsive-horizontal', after: '.bracket-public-products' }],
    '/minigames': [{ id: 'minigames-horizontal', type: 'responsive-horizontal', before: '.game-shell' }],
    '/about': [{ id: 'about-horizontal', type: 'responsive-horizontal', after: '.feature-v2-workflow' }],
    '/changelog': [{ id: 'changelog-horizontal', type: 'responsive-horizontal', after: '#august-4' }]
});

const APP_PLACEMENTS = Object.freeze({
    '/dashboard': [
        { id: 'app-dashboard-horizontal', type: 'responsive-horizontal', after: '.dashboard-priority-grid' },
        { id: 'app-dashboard-native', type: 'native', after: '.workspace-dashboard-continue' }
    ],
    '/app/advanced-stats': [
        { id: 'app-advanced-stats-horizontal', type: 'responsive-horizontal', after: '#advanced-stats-summary-section' },
        { id: 'app-advanced-stats-native', type: 'native', after: '.advanced-stats__two-column' },
        { id: 'app-advanced-stats-rectangle', type: 'rectangle-300x250', after: '#advanced-stats-units-section' }
    ],
    '/app/achievements': [
        { id: 'app-achievements-horizontal', type: 'responsive-horizontal', after: '.achievement-progress-panel' },
        { id: 'app-achievements-native', type: 'native', after: '.achievement-library' }
    ],
    '/app/cwl-planner-drafts': [{ id: 'app-drafts-horizontal', type: 'responsive-horizontal', after: '.drafts-header' }],
    '/app/cwl-planner': [{ id: 'app-planner-horizontal', type: 'responsive-horizontal', after: '.cwl-page-header' }],
    '/app/cwl-tracker': [
        { id: 'app-tracker-horizontal', type: 'responsive-horizontal', after: '#op-board-tabs' },
        { id: 'app-tracker-native', type: 'native', after: '#op-history-overview' }
    ],
    '/app/war-board': [
        { id: 'app-war-horizontal', type: 'responsive-horizontal', after: '#war-score-strip' },
        { id: 'app-war-native', type: 'native', after: '#war-panel-live' }
    ],
    '/app/clan-management': [
        { id: 'app-groups-horizontal', type: 'responsive-horizontal', after: '.cf-readiness-section' },
        { id: 'app-groups-native', type: 'native', after: '.cf-overview-grid' }
    ],
    '/app/explore': [
        { id: 'app-explore-horizontal', type: 'responsive-horizontal', after: '.workspace-page-header' },
        { id: 'app-explore-native', type: 'native', after: '.explore-grid' }
    ],
    '/app/brackets': [{ id: 'app-brackets-horizontal', type: 'responsive-horizontal', after: '.bracket-page-header' }],
    '/app/minigames': [{ id: 'app-minigames-horizontal', type: 'responsive-horizontal', after: '.minigames-hero' }]
});

export {
    AD_ELIGIBLE_ROUTES, AD_UNITS, APP_AD_ELIGIBLE_ROUTES,
    APP_PLACEMENTS, GUIDE_ROUTES, HARD_EXCLUDED_PREFIXES, LABELS,
    PLACEMENTS, PUBLIC_AD_ELIGIBLE_ROUTES
};
