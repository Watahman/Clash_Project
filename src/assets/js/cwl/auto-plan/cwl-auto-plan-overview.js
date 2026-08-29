import { t } from '../../i18n/i18n.js?v=20260829-public-auth-v1';

export function renderAutoPlanClanOverview({ result, renderActiveClan }) {
    const fragment = document.createDocumentFragment();
    const activeClans = result.clans.filter(clan => clan.status !== 'not-used');
    const unusedClans = result.clans.filter(clan => clan.status === 'not-used');
    fragment.appendChild(node(
        'p',
        'cwl-auto-plan-fill-summary',
        t('autoPlan.fillSummary', {
            active: result.activeCount ?? activeClans.length,
            total: result.totalClanCount ?? result.clans.length
        })
    ));
    if (activeClans.length) {
        fragment.appendChild(renderClanGroup({
            title: t('autoPlan.activeClans'),
            className: 'is-active',
            clans: activeClans,
            render: renderActiveClan
        }));
    }
    if (unusedClans.length) {
        fragment.appendChild(renderClanGroup({
            title: t('autoPlan.notUsedClans'),
            className: 'is-unused',
            clans: unusedClans,
            render: renderUnusedClan
        }));
    }
    return fragment;
}

function renderClanGroup({
    title, className, clans, render
}) {
    const section = node('section', `cwl-auto-plan-group ${className}`);
    const heading = node('header', 'cwl-auto-plan-group-heading');
    heading.append(
        node('h3', '', title),
        node('span', '', String(clans.length))
    );
    const content = node('div', 'cwl-auto-plan-group-content');
    clans.forEach(clan => content.appendChild(render(clan)));
    section.append(heading, content);
    return section;
}

function renderUnusedClan(clan) {
    const article = node('article', 'cwl-auto-plan-unused-clan');
    const name = node('div');
    name.append(
        node('h4', '', clan.name),
        node('p', '', clan.league || t('autoPlan.unknownLeague'))
    );
    article.append(
        name,
        node('span', 'cwl-auto-plan-unused-label', t('autoPlan.unfilled')),
        node('p', 'cwl-auto-plan-unused-reason', unusedReason(clan.reasonCode))
    );
    return article;
}

function unusedReason(reasonCode) {
    return reasonCode === 'not_enough_remaining_players'
        ? t('autoPlan.notEnoughRemainingPlayers')
        : t('autoPlan.notEnoughCompleteRoster');
}

function node(tag, className = '', text = '') {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}
