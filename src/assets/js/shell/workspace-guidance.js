import { t } from '../i18n/i18n.js?v=20260809-4';

const HINTS_KEY = 'clashtools_guidance_dismissed';
const INTENT_KEY = 'clashtools_first_intent';

const pageHelp = Object.freeze({
    dashboard: {
        title: 'guidance.dashboard.title',
        intro: 'guidance.dashboard.intro',
        items: [
            'guidance.dashboard.itemPlan',
            'guidance.dashboard.itemRun',
            'guidance.dashboard.itemFamily',
            'guidance.dashboard.itemGames',
            'guidance.dashboard.itemAchievements',
            'guidance.dashboard.itemAdvancedStats'
        ]
    },
    planner: {
        title: 'guidance.planner.title',
        intro: 'guidance.planner.intro',
        items: [
            'guidance.planner.itemRoster',
            'guidance.planner.itemAvailability',
            'guidance.planner.itemAuto',
            'guidance.planner.itemOptimize',
            'guidance.planner.itemSave'
        ]
    },
    operation: {
        title: 'guidance.operation.title',
        intro: 'guidance.operation.intro',
        items: [
            'guidance.operation.itemLoad',
            'guidance.operation.itemLive',
            'guidance.operation.itemLeague',
            'guidance.operation.itemRoster',
            'guidance.operation.itemBonus',
            'guidance.operation.itemHistory'
        ]
    },
    groups: {
        title: 'guidance.groups.title',
        intro: 'guidance.groups.intro',
        items: [
            'guidance.groups.itemMembers',
            'guidance.groups.itemPolls',
            'guidance.groups.itemClans',
            'guidance.groups.itemPlanner'
        ]
    },
    warOperation: {
        title: 'guidance.war.title',
        intro: 'guidance.war.intro',
        items: [
            'guidance.war.itemLoad',
            'guidance.war.itemLive',
            'guidance.war.itemMap',
            'guidance.war.itemRoster',
            'guidance.war.itemHistory'
        ]
    },
    drafts: {
        title: 'guidance.drafts.title',
        intro: 'guidance.drafts.intro',
        items: ['guidance.drafts.itemOpen', 'guidance.drafts.itemSearch']
    },
    bracket: {
        title: 'guidance.bracket.title',
        intro: 'guidance.bracket.intro',
        items: []
    },
    achievements: {
        title: 'guidance.achievements.title',
        intro: 'guidance.achievements.intro',
        items: [
            'guidance.achievements.itemAccount',
            'guidance.achievements.itemSources',
            'guidance.achievements.itemSnapshot',
            'guidance.achievements.itemExplore'
        ]
    },
    advancedStats: {
        title: 'guidance.advancedStats.title',
        intro: 'guidance.advancedStats.intro',
        items: [
            'guidance.advancedStats.itemAccount',
            'guidance.advancedStats.itemTracking',
            'guidance.advancedStats.itemHistory',
            'guidance.advancedStats.itemControls'
        ]
    }
});

const tabDescriptions = Object.freeze({
    operation: {
        '#op-panel-summary': 'guidance.tabs.operationSummary',
        '#op-panel-live': 'guidance.tabs.operationLive',
        '#op-panel-league': 'guidance.tabs.operationLeague',
        '#op-panel-roster': 'guidance.tabs.operationRoster',
        '#op-panel-bonuses': 'guidance.tabs.operationBonuses'
    },
    groups: {
        '[data-group-panel="members"]': 'guidance.tabs.groupMembers',
        '[data-group-panel="availability"]': 'guidance.tabs.groupAvailability',
        '[data-group-panel="polls"]': 'guidance.tabs.groupPolls',
        '[data-group-panel="clans"]': 'guidance.tabs.groupClans'
    },
    warOperation: {
        '[data-war-panel="live"]': 'guidance.tabs.warLive',
        '[data-war-panel="map"]': 'guidance.tabs.warMap',
        '[data-war-panel="roster"]': 'guidance.tabs.warRoster',
        '[data-war-panel="history"]': 'guidance.tabs.warHistory'
    }
});

function readDismissedHints() {
    try {
        const value = JSON.parse(localStorage.getItem(HINTS_KEY) || '[]');
        return new Set(Array.isArray(value) ? value : []);
    } catch {
        return new Set();
    }
}

function dismissHint(name) {
    const dismissed = readDismissedHints();
    dismissed.add(name);
    try {
        localStorage.setItem(HINTS_KEY, JSON.stringify([...dismissed]));
    } catch {
        // Hints remain dismissible for this page when storage is unavailable.
    }
}

function createHelpDrawer(page) {
    const dialog = document.createElement('dialog');
    dialog.className = 'workspace-help-drawer';
    dialog.id = 'workspace-help-drawer';
    dialog.setAttribute('aria-labelledby', 'workspace-help-title');
    dialog.innerHTML = `
        <div class="workspace-help-drawer-panel">
            <header>
                <div>
                    <p class="page-kicker" data-guidance-help-kicker></p>
                    <h2 id="workspace-help-title"></h2>
                </div>
                <button class="workspace-help-close" type="button" aria-label="Close">&times;</button>
            </header>
            <div class="workspace-help-tabs" role="tablist" data-guidance-tabs-label>
                <button type="button" role="tab" data-guidance-view="page" aria-controls="workspace-help-content" aria-selected="true"></button>
                <button type="button" role="tab" data-guidance-view="profile" aria-controls="workspace-help-content" aria-selected="false"></button>
            </div>
            <section id="workspace-help-content" class="workspace-help-content" role="tabpanel">
                <p class="workspace-help-intro"></p>
                <ul class="workspace-help-list"></ul>
            </section>
        </div>`;
    document.body.appendChild(dialog);

    let activePage = page;
    let activeView = 'page';
    let returnFocus = null;

    const render = () => {
        const config = activeView === 'profile'
            ? {
                title: 'guidance.profile.title',
                intro: 'guidance.profile.intro',
                items: [
                    'guidance.profile.itemAccounts',
                    'guidance.profile.itemFriends',
                    'guidance.profile.itemFamily',
                    'guidance.profile.itemSettings'
                ]
            }
            : pageHelp[activePage] || pageHelp.dashboard;
        dialog.querySelector('[data-guidance-help-kicker]').textContent = t(
            activeView === 'profile' ? 'guidance.profile.kicker' : 'guidance.help.kicker'
        );
        dialog.querySelector('#workspace-help-title').textContent = t(config.title);
        dialog.querySelector('.workspace-help-intro').textContent = t(config.intro);
        dialog.querySelector('.workspace-help-close').setAttribute('aria-label', t('common.close'));
        dialog.querySelector('[data-guidance-tabs-label]').setAttribute('aria-label', t('guidance.help.sections'));
        dialog.querySelector('[data-guidance-view="page"]').textContent = t('guidance.help.pageTab');
        dialog.querySelector('[data-guidance-view="profile"]').textContent = t('guidance.help.profileTab');
        dialog.querySelectorAll('[data-guidance-view]').forEach(button => {
            const selected = button.dataset.guidanceView === activeView;
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        const list = dialog.querySelector('.workspace-help-list');
        list.replaceChildren(...config.items.map(key => {
            const item = document.createElement('li');
            item.textContent = t(key);
            return item;
        }));
    };

    const close = () => {
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        else dialog.removeAttribute('open');
        returnFocus?.focus();
    };
    const open = (requestedPage = page, trigger = document.activeElement) => {
        activePage = pageHelp[requestedPage] ? requestedPage : page;
        activeView = 'page';
        returnFocus = trigger;
        render();
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        dialog.querySelector('.workspace-help-close')?.focus();
    };

    dialog.querySelector('.workspace-help-close').addEventListener('click', close);
    dialog.querySelector('.workspace-help-tabs').addEventListener('click', event => {
        const button = event.target.closest('[data-guidance-view]');
        if (!button) return;
        activeView = button.dataset.guidanceView;
        render();
    });
    dialog.querySelector('.workspace-help-tabs').addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        activeView = activeView === 'page' ? 'profile' : 'page';
        render();
        dialog.querySelector(`[data-guidance-view="${activeView}"]`)?.focus();
    });
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        close();
    });
    dialog.addEventListener('click', event => {
        if (event.target === dialog) close();
    });
    window.addEventListener('clashtools:language-changed', render);
    render();
    return { open, render };
}

function mountGlobalHelp(page, drawer) {
    const actions = document.querySelector('.workspace-top-actions');
    if (!actions || actions.querySelector('#workspace-help-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'workspace-help-button';
    button.className = 'workspace-icon-button workspace-help-button';
    button.textContent = '?';
    const render = () => {
        const label = t('guidance.help.open');
        button.setAttribute('aria-label', label);
        button.title = label;
    };
    button.addEventListener('click', () => drawer.open(page, button));
    actions.insertBefore(button, document.querySelector('#workspace-notifications-root'));
    window.addEventListener('clashtools:language-changed', render);
    render();
}

function pageHeader(page) {
    const selectors = {
        dashboard: '.workspace-page-header',
        planner: '.cwl-page-header > div:first-child',
        operation: '.op-page-header > div:first-child',
        groups: '.groups-page-header > div:first-child',
        warOperation: '.war-board-header > div:first-child',
        drafts: '.drafts-header > div:first-child',
        achievements: '.achievement-hero-copy',
        advancedStats: '.advanced-stats__hero > div:first-child'
    };
    const selector = selectors[page];
    return selector ? document.querySelector(selector) : null;
}

function mountPageHelp(page, drawer) {
    const header = pageHeader(page);
    if (!header || header.querySelector('.workspace-page-help-trigger')) return;
    header.classList.add('workspace-page-guidance-copy');
    const button = document.createElement('button');
    button.className = 'workspace-page-help-trigger';
    button.type = 'button';
    const render = () => {
        button.textContent = t('guidance.help.pageAction');
        button.setAttribute('aria-label', `${t('guidance.help.pageAction')}: ${t(pageHelp[page]?.title || 'guidance.dashboard.title')}`);
    };
    button.addEventListener('click', () => drawer.open(page, button));
    const subtitle = header.querySelector(':scope > p:last-of-type');
    subtitle?.classList.add('workspace-page-subtitle');
    header.appendChild(button);
    window.addEventListener('clashtools:language-changed', render);
    render();
}

function mountTabDescriptions(page) {
    const descriptions = tabDescriptions[page];
    if (!descriptions) return;
    const render = () => {
        Object.entries(descriptions).forEach(([selector, key]) => {
            const panel = document.querySelector(selector);
            if (!panel) return;
            let copy = panel.querySelector(':scope > .workspace-tab-description');
            if (!copy) {
                copy = document.createElement('p');
                copy.className = 'workspace-tab-description';
                panel.prepend(copy);
            }
            copy.textContent = t(key);
        });
    };
    window.addEventListener('clashtools:language-changed', render);
    render();
}

function statusStep(key, labelKey) {
    const item = document.createElement('li');
    item.dataset.guidanceStep = key;
    item.innerHTML = `<span aria-hidden="true"></span><div><strong></strong><small></small></div>`;
    item.querySelector('strong').dataset.labelKey = labelKey;
    return item;
}

function setStep(workflow, key, { complete = false, current = false, text = '' }) {
    const item = workflow.querySelector(`[data-guidance-step="${key}"]`);
    if (!item) return;
    item.classList.toggle('is-complete', complete);
    item.classList.toggle('is-current', current);
    item.querySelector('small').textContent = text;
}

function plannerNumbers() {
    const players = Math.max(
        0,
        Number(document.querySelector('#cwl-total-player-amount')?.textContent) || 0
    );
    const clans = document.querySelectorAll('#cwl-all-clans .cwl-clan-article').length;
    const assigned = document.querySelectorAll(
        '#cwl-all-clans .cwl-player-article[data-planner-card="true"]'
    ).length;
    return { players, clans, assigned };
}

function mountPlannerEmptyStates() {
    const setText = (node, value) => {
        if (node && node.textContent !== value) node.textContent = value;
    };
    const render = () => {
        const players = document.querySelector('#cwl-available-players');
        const clans = document.querySelector('#cwl-all-clans');
        if (players) {
            const hasPlayers = Boolean(players.querySelector('.cwl-player-article[data-planner-card="true"]'));
            let empty = players.querySelector(':scope > .workspace-guidance-empty');
            if (hasPlayers) empty?.remove();
            else if (!empty) {
                empty = document.createElement('div');
                empty.className = 'workspace-guidance-empty';
                empty.dataset.guidanceEmpty = 'players';
                empty.innerHTML = '<strong></strong><p></p>';
                players.appendChild(empty);
            }
            if (empty) {
                const hasAssignedPlayers = plannerNumbers().assigned > 0;
                setText(empty.querySelector('strong'), t(hasAssignedPlayers
                    ? 'guidance.planner.emptyFreeTitle'
                    : 'guidance.planner.emptyPlayersTitle'));
                setText(empty.querySelector('p'), t(hasAssignedPlayers
                    ? 'guidance.planner.emptyFreeText'
                    : 'guidance.planner.emptyPlayersText'));
            }
        }
        if (clans) {
            const hasClans = Boolean(clans.querySelector('.cwl-clan-article'));
            let empty = clans.querySelector(':scope > .workspace-guidance-empty');
            if (hasClans) empty?.remove();
            else if (!empty) {
                empty = document.createElement('div');
                empty.className = 'workspace-guidance-empty workspace-guidance-empty-board';
                empty.dataset.guidanceEmpty = 'clans';
                empty.innerHTML = '<strong></strong><p></p>';
                clans.appendChild(empty);
            }
            if (empty) {
                setText(empty.querySelector('strong'), t('guidance.planner.emptyClansTitle'));
                setText(empty.querySelector('p'), t('guidance.planner.emptyClansText'));
            }
        }
    };
    window.addEventListener('clashtools:language-changed', render);
    const observer = new MutationObserver(render);
    ['#cwl-available-players', '#cwl-all-clans'].forEach(selector => {
        const node = document.querySelector(selector);
        if (node) observer.observe(node, { childList: true, subtree: true });
    });
    render();
}

function parseStat(selector) {
    const value = document.querySelector(selector)?.textContent || '';
    const match = value.match(/\d+/);
    return match ? Number(match[0]) : 0;
}

function mountGroupChecklist() {
    const header = document.querySelector('.groups-page-header');
    if (!header || document.querySelector('#groups-setup-checklist')) return;
    const details = document.createElement('details');
    details.id = 'groups-setup-checklist';
    details.className = 'workspace-setup-checklist';
    details.open = false;
    details.innerHTML = `
        <summary><span><strong></strong><small></small></span><span aria-hidden="true">⌄</span></summary>
        <ol>
            <li data-check="family"><span></span><div><strong></strong><small></small></div></li>
            <li data-check="clan"><span></span><div><strong></strong><small></small></div></li>
            <li data-check="accounts"><span></span><div><strong></strong><small></small></div></li>
            <li data-check="poll"><span></span><div><strong></strong><small></small></div></li>
        </ol>`;
    header.after(details);

    let collapsedAfterComplete = false;
    const render = () => {
        const selected = !document.querySelector('#groups-detail-content')?.classList.contains('hidden');
        const clans = parseStat('#groups-inspector-clans');
        const accounts = parseStat('#groups-inspector-accounts');
        const poll = Boolean(
            document.querySelector('#groups-admin-polls-list .groups-admin-member')
            || !document.querySelector('#groups-poll-notice')?.classList.contains('hidden')
        );
        const states = { family: selected, clan: clans > 0, accounts: accounts > 0, poll };
        const complete = Object.values(states).every(Boolean);
        details.querySelector('summary strong').textContent = complete
            ? t('guidance.groups.checklistComplete')
            : t('guidance.groups.checklistTitle');
        details.querySelector('summary small').textContent = complete
            ? t('guidance.groups.checklistCompleteHelp')
            : t('guidance.groups.checklistHelp');
        const keys = {
            family: ['guidance.groups.checkFamily', 'guidance.groups.checkFamilyHelp'],
            clan: ['guidance.groups.checkClan', 'guidance.groups.checkClanHelp'],
            accounts: ['guidance.groups.checkAccounts', 'guidance.groups.checkAccountsHelp'],
            poll: ['guidance.groups.checkPoll', 'guidance.groups.checkPollHelp']
        };
        Object.entries(states).forEach(([name, done]) => {
            const item = details.querySelector(`[data-check="${name}"]`);
            item.classList.toggle('is-complete', done);
            item.querySelector('strong').textContent = t(keys[name][0]);
            item.querySelector('small').textContent = done ? t('guidance.groups.done') : t(keys[name][1]);
        });
        if (complete && !collapsedAfterComplete) {
            details.open = false;
            collapsedAfterComplete = true;
        }
    };
    const observer = new MutationObserver(render);
    ['#groups-detail-content', '#groups-inspector-clans', '#groups-inspector-accounts', '#groups-admin-polls-list', '#groups-poll-notice']
        .forEach(selector => {
            const node = document.querySelector(selector);
            if (node) observer.observe(node, { childList: true, subtree: true, attributes: true });
        });
    window.addEventListener('clashtools:language-changed', render);
    render();
}

function mountDashboardIntent() {
    let state = null;
    const render = () => {
        document.querySelector('#dashboard-first-intent')?.remove();
        if (!state?.loggedIn || state.hasErrors || state.plans || state.groups || state.accounts) return;
        if (localStorage.getItem(INTENT_KEY)) return;
        const header = document.querySelector('.workspace-page-header');
        if (!header) return;
        const section = document.createElement('section');
        section.id = 'dashboard-first-intent';
        section.className = 'workspace-first-intent';
        section.innerHTML = `
            <div><p class="page-kicker"></p><h2></h2><p data-intent-copy></p></div>
            <div class="workspace-first-intent-actions">
                <a href="/app/cwl-planner" data-intent="planner"></a>
                <a href="/app/cwl-tracker" data-intent="operation"></a>
                <a href="/app/clan-management" data-intent="groups"></a>
                <button type="button"></button>
            </div>`;
        section.querySelector('.page-kicker').textContent = t('guidance.intent.kicker');
        section.querySelector('h2').textContent = t('guidance.intent.title');
        section.querySelector('[data-intent-copy]').textContent = t('guidance.intent.copy');
        section.querySelector('[data-intent="planner"]').textContent = t('guidance.intent.plan');
        section.querySelector('[data-intent="operation"]').textContent = t('guidance.intent.run');
        section.querySelector('[data-intent="groups"]').textContent = t('guidance.intent.family');
        section.querySelector('button').textContent = t('guidance.intent.skip');
        section.querySelectorAll('[data-intent]').forEach(link => {
            link.addEventListener('click', () => localStorage.setItem(INTENT_KEY, link.dataset.intent));
        });
        section.querySelector('button').addEventListener('click', () => {
            localStorage.setItem(INTENT_KEY, 'skipped');
            section.remove();
        });
        header.after(section);
    };
    window.addEventListener('clashtools:dashboard-state', event => {
        state = event.detail;
        render();
    });
    window.addEventListener('clashtools:language-changed', render);
}

export function initWorkspaceGuidance(page = document.body.dataset.workspacePage || 'dashboard') {
    if (document.body.dataset.guidanceReady === 'true') return;
    document.body.dataset.guidanceReady = 'true';
    const drawer = createHelpDrawer(page);
    mountGlobalHelp(page, drawer);
    mountPageHelp(page, drawer);
    mountTabDescriptions(page);
    if (page === 'planner') {
        mountPlannerEmptyStates();
    }
    if (page === 'groups') mountGroupChecklist();
    if (page === 'dashboard') mountDashboardIntent();
}
