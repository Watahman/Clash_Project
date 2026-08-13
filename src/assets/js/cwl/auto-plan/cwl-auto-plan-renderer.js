import { t } from '../../i18n/i18n.js';
import { renderAutoPlanClanOverview } from './cwl-auto-plan-overview.js';

export function renderAutoPlanPreview({
    container,
    result,
    guidedOverrides,
    registrationReasons
}) {
    container.replaceChildren();
    const fragment = document.createDocumentFragment();
    fragment.appendChild(renderAutoPlanClanOverview({
        result,
        renderActiveClan: clan => renderClan({
            clan,
            result,
            guidedOverrides,
            registrationReasons
        })
    }));
    fragment.appendChild(renderChanges(result));
    container.appendChild(fragment);
}

function renderClan({ clan, result, guidedOverrides, registrationReasons }) {
    const section = node('section', 'cwl-auto-plan-clan');
    section.dataset.clanId = clan.id;
    const heading = node('header', 'cwl-auto-plan-clan-heading');
    const title = node('div');
    const counts = countRoles(clan.players);
    title.append(
        node('h3', '', `${clan.name} · ${clan.league || t('autoPlan.unknownLeague')}`),
        node('p', '', t('autoPlan.activeRosterSummary', {
            active: counts.core + counts.rotation,
            reserve: counts.reserve
        })),
        node('p', 'cwl-auto-plan-format', t('autoPlan.formatValue', {
            capacity: clan.capacity
        }))
    );
    heading.append(title, node(
        'span',
        `cwl-auto-plan-readiness is-${clan.readiness.status}`,
        t(`autoPlan.readiness${readinessKey(clan.readiness.status)}`)
    ));

    const metrics = node('dl', 'cwl-auto-plan-metrics');
    metric(metrics, t('autoPlan.core'), counts.core);
    metric(metrics, t('autoPlan.rotation'), counts.rotation);
    metric(metrics, t('autoPlan.reserve'), counts.reserve);
    metric(
        metrics,
        t('autoPlan.expectedPerformance'),
        clan.readiness.expectedPerRound == null
            ? '—'
            : `${clan.readiness.expectedPerRound.toFixed(1)}★ / ${t('autoPlan.round')}`
    );
    metric(
        metrics,
        t('autoPlan.reliability'),
        clan.readiness.reliability == null ? '—' : `${clan.readiness.reliability}%`
    );

    section.append(
        heading,
        metrics,
        node(
            'p',
            'cwl-auto-plan-readiness-text',
            clan.readiness.explanationKey
                ? t(clan.readiness.explanationKey, clan.readiness.explanationParams)
                : clan.readiness.explanation
        )
    );
    if (clan.warnings.length) section.appendChild(renderWarnings(clan.warnings));
    if (result.mode === 'guided') {
        section.appendChild(renderGuidedControls({
            clan,
            result,
            activeOverride: guidedOverrides.get(clan.id),
            registrationReasons
        }));
    }
    return section;
}

function renderGuidedControls({
    clan, result, activeOverride, registrationReasons
}) {
    const details = node('details', 'cwl-auto-plan-guided');
    const content = node('div', 'cwl-auto-plan-guided-content');
    const roleEditablePlayers = clan.players;
    const swapEditablePlayers = clan.players.filter(player =>
        registrationReasons?.[player.tag] !== 'registered-cwl-roster'
    );
    const roleRow = node('div', 'cwl-auto-plan-override-row');
    roleRow.append(
        field(t('autoPlan.player'), select(
            'data-auto-role-player',
            roleEditablePlayers.map(player => [player.tag, player.name])
        )),
        field(t('autoPlan.newRole'), select('data-auto-role', [
            ['core', t('autoPlan.roleCore')],
            ['rotation', t('autoPlan.roleRotation')],
            ['reserve', t('autoPlan.roleReserve')]
        ])),
        actionButton('role', t('autoPlan.lockRole'), clan.id, !roleEditablePlayers.length)
    );
    const freeOptions = result.freePlayers.map(player => [player.tag, player.name]);
    const swapRow = node('div', 'cwl-auto-plan-override-row');
    swapRow.append(
        field(t('autoPlan.replace'), select(
            'data-auto-swap-out',
            swapEditablePlayers.map(player => [player.tag, player.name])
        )),
        field(t('autoPlan.withPlayer'), select('data-auto-swap-in', freeOptions)),
        actionButton(
            'swap',
            t('autoPlan.lockSwap'),
            clan.id,
            !swapEditablePlayers.length || !freeOptions.length
        )
    );
    content.append(roleRow, swapRow);
    if (activeOverride) {
        content.appendChild(actionButton('clear', t('autoPlan.clearOverride'), clan.id));
    }
    details.append(
        node(
            'summary',
            '',
            activeOverride ? t('autoPlan.guidedLocked') : t('autoPlan.guidedOverride')
        ),
        content
    );
    return details;
}

function renderWarnings(warnings) {
    const list = node('ul', 'cwl-auto-plan-warnings');
    warnings.forEach(warning => list.appendChild(node(
        'li',
        '',
        warningText(warning)
    )));
    return list;
}

function warningText(warning) {
    if (warning.code === 'incomplete_roster') {
        return t('autoPlan.warningIncompleteRoster', {
            active: warning.active,
            required: warning.required
        });
    }
    return warning.message;
}

function renderChanges(result) {
    const section = node('section', 'cwl-auto-plan-changes');
    section.appendChild(node('h3', '', t('autoPlan.changes')));
    if (!result.changes.length) {
        section.appendChild(node('p', '', t('autoPlan.noChanges')));
        return section;
    }
    const list = node('ul');
    result.changes.forEach(change => {
        const destination = change.toClanName
            ? `${change.toClanName} · ${t(`autoPlan.role${capitalize(change.role)}`)}`
            : t('autoPlan.freeRoster');
        list.appendChild(node('li', '', `${change.playerName} → ${destination}`));
    });
    section.appendChild(list);
    return section;
}

function countRoles(players) {
    return players.reduce((counts, player) => {
        counts[player.role] += 1;
        return counts;
    }, { core: 0, rotation: 0, reserve: 0 });
}

function metric(list, label, value) {
    list.append(node('dt', '', label), node('dd', '', String(value)));
}

function field(label, control) {
    const wrapper = node('label');
    wrapper.append(node('span', '', label), control);
    return wrapper;
}

function select(attribute, options) {
    const element = node('select');
    element.setAttribute(attribute, '');
    options.forEach(([value, label]) => {
        const option = node('option', '', label);
        option.value = value;
        element.appendChild(option);
    });
    return element;
}

function actionButton(action, label, clanId, disabled = false) {
    const button = node('button', 'button button-secondary', label);
    button.type = 'button';
    button.dataset.autoPlanAction = action;
    button.dataset.clanId = clanId;
    button.disabled = disabled;
    return button;
}

function node(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function readinessKey(status) {
    return status === 'low-confidence' ? 'LowConfidence' : capitalize(status);
}

function capitalize(value) {
    return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
}
