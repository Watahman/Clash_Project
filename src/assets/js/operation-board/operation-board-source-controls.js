import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import {
    getPlanClans,
    hasUsefulClanName
} from './operation-board-plan-model.js?v=20260829-public-auth-v1';
import { option } from './operation-board-render-utils.js?v=20260829-public-auth-v1';
import { fetchClanName } from './operation-board-source.js?v=20260829-public-auth-v1';

export function renderPlanLoading(refs, userId) {
    refs.planSelect.replaceChildren(option(
        '',
        userId ? t('op.loadingPlans') : t('groups.login'),
        { disabled: true, selected: true }
    ));
    renderPlanRequired(refs);
}

export function renderPlanRequired(refs) {
    refs.clanSelect.replaceChildren(option(
        '',
        t('op.selectPlanFirst'),
        { disabled: true, selected: true }
    ));
    refs.clanSelect.disabled = true;
}

export function renderPlanOptions(refs, plans) {
    refs.planSelect.replaceChildren(option(
        '',
        plans.length ? t('op.selectPlanPlaceholder') : t('cwl.noPlan'),
        { disabled: true, selected: true }
    ));
    plans.forEach(plan => refs.planSelect.appendChild(option(plan.id, plan.name)));
}

export function renderPlanError(refs) {
    refs.planSelect.replaceChildren(option(
        '',
        t('groups.loadError'),
        { disabled: true, selected: true }
    ));
}

export function renderClanLoading(refs) {
    refs.clanSelect.disabled = true;
    refs.clanSelect.replaceChildren(option(
        '',
        t('op.loadingClans'),
        { disabled: true, selected: true }
    ));
}

export function renderClanOptions(refs, plan, isCurrent = () => true) {
    refs.clanSelect.replaceChildren(option(
        '',
        t('op.selectClanPlaceholder'),
        { disabled: true, selected: true }
    ));
    const clans = getPlanClans(plan);
    clans.forEach(clan => {
        const item = option(
            clan.tag,
            hasUsefulClanName(clan) ? clan.name : t('op.loadingClanName')
        );
        refs.clanSelect.appendChild(item);
        if (!hasUsefulClanName(clan)) {
            fetchClanName(clan.tag).then(name => {
                if (isCurrent()) {
                    clan.name = name;
                    item.textContent = name;
                }
            }).catch(() => {
                item.textContent = clan.tag;
            });
        }
    });
    refs.clanSelect.disabled = !clans.length;
    return clans;
}

export function renderStandaloneMode(refs) {
    refs.planSelect.value = '';
    refs.clanSelect.disabled = true;
    refs.clanSelect.replaceChildren(option(
        '',
        t('op.standaloneMode'),
        { disabled: true, selected: true }
    ));
}
