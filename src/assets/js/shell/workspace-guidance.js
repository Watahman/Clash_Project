import { t } from '../i18n/i18n.js';

const HINTS_KEY = 'clashtools_guidance_dismissed';
const INTENT_KEY = 'clashtools_first_intent';

const pageHelp = Object.freeze({
    dashboard: {
        title: 'guidance.dashboard.title',
        intro: 'guidance.dashboard.intro',
        items: [
            'guidance.dashboard.itemPlan',
            'guidance.dashboard.itemRun',
            'guidance.dashboard.itemFamily'
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
        items: ['guidance.drafts.itemOpen', 'guidance.drafts.itemSearch', 'guidance.drafts.itemLimit']
    },
    bracket: {
        title: 'guidance.bracket.title',
        intro: 'guidance.bracket.intro',
        items: []
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
            <p class="workspace-help-intro"></p>
            <ul class="workspace-help-list"></ul>
            <nav class="workspace-help-links" aria-label="ClashPanel tools">
                <a href="/dashboard" data-guidance-link="dashboard"></a>
                <a href="/app/cwl-planner" data-guidance-link="planner"></a>
                <a href="/app/cwl-tracker" data-guidance-link="operation"></a>
                <a href="/app/clan-management" data-guidance-link="groups"></a>
            </nav>
        </div>`;
    document.body.appendChild(dialog);

    let activePage = page;
    let returnFocus = null;

    const render = () => {
        const config = pageHelp[activePage] || pageHelp.dashboard;
        dialog.querySelector('[data-guidance-help-kicker]').textContent = t('guidance.help.kicker');
        dialog.querySelector('#workspace-help-title').textContent = t(config.title);
        dialog.querySelector('.workspace-help-intro').textContent = t(config.intro);
        dialog.querySelector('.workspace-help-close').setAttribute('aria-label', t('common.close'));
        const list = dialog.querySelector('.workspace-help-list');
        list.replaceChildren(...config.items.map(key => {
            const item = document.createElement('li');
            item.textContent = t(key);
            return item;
        }));
        dialog.querySelector('[data-guidance-link="dashboard"]').textContent = t('nav.dashboard');
        dialog.querySelector('[data-guidance-link="planner"]').textContent = t('nav.cwl');
        dialog.querySelector('[data-guidance-link="operation"]').textContent = t('nav.operation');
        dialog.querySelector('[data-guidance-link="groups"]').textContent = t('nav.groups');
    };

    const close = () => {
        if (typeof dialog.close === 'function' && dialog.open) dialog.close();
        else dialog.removeAttribute('open');
        returnFocus?.focus();
    };
    const open = (requestedPage = page, trigger = document.activeElement) => {
        activePage = pageHelp[requestedPage] ? requestedPage : page;
        returnFocus = trigger;
        render();
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
        dialog.querySelector('.workspace-help-close')?.focus();
    };

    dialog.querySelector('.workspace-help-close').addEventListener('click', close);
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
        drafts: '.drafts-header > div:first-child'
    };
    return document.querySelector(selectors[page] || '');
}

function mountPageHelp(page, drawer) {
    const header = pageHeader(page);
    if (!header || header.querySelector('.workspace-page-help-trigger')) return;
    const button = document.createElement('button');
    button.className = 'workspace-page-help-trigger';
    button.type = 'button';
    const render = () => {
        button.textContent = t('guidance.help.pageAction');
        button.setAttribute('aria-label', `${t('guidance.help.pageAction')}: ${t(pageHelp[page]?.title || 'guidance.dashboard.title')}`);
    };
    button.addEventListener('click', () => drawer.open(page, button));
    const subtitle = header.querySelector(':scope > p:last-of-type');
    if (subtitle) {
        subtitle.append(document.createElement('br'), button);
    } else {
        header.appendChild(button);
    }
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
                empty.innerHTML = '<strong></strong><p></p><button type="button" data-guidance-action="add-players"></button>';
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
                setText(empty.querySelector('button'), t('cwl.addPlayers'));
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
                empty.innerHTML = '<strong></strong><p></p><button type="button" data-guidance-action="add-clan"></button>';
                clans.appendChild(empty);
            }
            if (empty) {
                setText(empty.querySelector('strong'), t('guidance.planner.emptyClansTitle'));
                setText(empty.querySelector('p'), t('guidance.planner.emptyClansText'));
                setText(empty.querySelector('button'), t('cwl.addClan'));
            }
        }
    };
    document.addEventListener('click', event => {
        const action = event.target.closest('[data-guidance-action]')?.dataset.guidanceAction;
        if (action === 'add-players') document.querySelector('#cwl-add-players-button')?.click();
        if (action === 'add-clan') document.querySelector('#cwl-add-clan-button')?.click();
    });
    window.addEventListener('clashtools:language-changed', render);
    const observer = new MutationObserver(render);
    ['#cwl-available-players', '#cwl-all-clans'].forEach(selector => {
        const node = document.querySelector(selector);
        if (node) observer.observe(node, { childList: true, subtree: true });
    });
    render();
}

function mountPlannerWorkflow() {
    const header = document.querySelector('.cwl-page-header');
    if (!header || document.querySelector('#cwl-guidance-workflow')) return;
    const section = document.createElement('section');
    section.id = 'cwl-guidance-workflow';
    section.className = 'workspace-guidance-workflow';
    section.setAttribute('aria-labelledby', 'cwl-guidance-workflow-title');
    const heading = document.createElement('div');
    heading.className = 'workspace-guidance-workflow-heading';
    heading.innerHTML = '<div><p class="page-kicker"></p><h2 id="cwl-guidance-workflow-title"></h2></div><p></p>';
    const steps = document.createElement('ol');
    steps.append(
        statusStep('roster', 'guidance.planner.stepRoster'),
        statusStep('availability', 'guidance.planner.stepAvailability'),
        statusStep('lineups', 'guidance.planner.stepLineups'),
        statusStep('review', 'guidance.planner.stepReview'),
        statusStep('save', 'guidance.planner.stepSave')
    );
    section.append(heading, steps);
    header.after(section);

    const render = () => {
        heading.querySelector('.page-kicker').textContent = t('guidance.planner.workflowKicker');
        heading.querySelector('h2').textContent = t('guidance.planner.workflowTitle');
        heading.querySelector(':scope > p').textContent = t('guidance.planner.workflowHelp');
        steps.querySelectorAll('[data-label-key]').forEach(label => {
            label.textContent = t(label.dataset.labelKey);
        });
        const { players, clans, assigned } = plannerNumbers();
        const poll = document.querySelector('#cwl-roster-poll-select');
        const pollSelected = Boolean(poll?.value);
        const save = document.querySelector('#cwl-save-status');
        const saveState = save?.dataset.state || 'idle';
        const persisted = Boolean(localStorage.getItem('planner_id'));
        setStep(section, 'roster', {
            complete: players > 0,
            current: players === 0,
            text: players ? t('guidance.planner.playersCount', { count: players }) : t('guidance.planner.notStarted')
        });
        setStep(section, 'availability', {
            complete: pollSelected,
            current: players > 0 && !pollSelected,
            text: pollSelected
                ? t('guidance.planner.pollLinked')
                : t('guidance.planner.pollOptional')
        });
        setStep(section, 'lineups', {
            complete: clans > 0 && assigned > 0,
            current: players > 0 && (clans === 0 || assigned === 0),
            text: clans
                ? t('guidance.planner.lineupCount', { assigned, clans })
                : t('guidance.planner.noClans')
        });
        setStep(section, 'review', {
            current: assigned > 0,
            text: t('guidance.planner.reviewOptional')
        });
        setStep(section, 'save', {
            complete: persisted && !['error', 'conflict'].includes(saveState),
            current: assigned > 0 && !persisted,
            text: saveState === 'saving'
                ? t('cwl.saving')
                : ['error', 'conflict'].includes(saveState)
                    ? save.textContent
                    : persisted ? t('cwl.saved') : t('guidance.planner.notSaved')
        });
    };

    const observer = new MutationObserver(render);
    ['#cwl-total-player-amount', '#cwl-all-clans', '#cwl-save-status', '#cwl-roster-poll-select']
        .forEach(selector => {
            const node = document.querySelector(selector);
            if (node) observer.observe(node, { childList: true, subtree: true, attributes: true });
        });
    document.querySelector('#cwl-roster-poll-select')?.addEventListener('change', render);
    ['clashtools:cwl-plan-loaded', 'clashtools:cwl-player-added', 'clashtools:cwl-player-removed']
        .forEach(name => window.addEventListener(name, render));
    window.addEventListener('clashtools:language-changed', render);
    render();

    if (!readDismissedHints().has('planner-tools')) {
        const hint = document.createElement('aside');
        hint.className = 'workspace-first-use-hint';
        hint.innerHTML = '<div><strong></strong><p></p></div><button type="button"></button>';
        const renderHint = () => {
            hint.querySelector('strong').textContent = t('guidance.planner.hintTitle');
            hint.querySelector('p').textContent = t('guidance.planner.hintText');
            hint.querySelector('button').textContent = t('guidance.hint.dismiss');
        };
        hint.querySelector('button').addEventListener('click', () => {
            dismissHint('planner-tools');
            hint.remove();
        });
        section.after(hint);
        window.addEventListener('clashtools:language-changed', renderHint);
        renderHint();
    }
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
    details.open = true;
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
        mountPlannerWorkflow();
        mountPlannerEmptyStates();
    }
    if (page === 'groups') mountGroupChecklist();
    if (page === 'dashboard') mountDashboardIntent();
}
