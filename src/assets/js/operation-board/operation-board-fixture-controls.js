import { normalizePlan } from './operation-board-plan-model.js';
import { competeT as t } from './compete-locales.js';
import {
    renderPlanOptions,
    renderStandaloneMode
} from './operation-board-source-controls.js';

export function setSourceMode(mode, root = document) {
    root.querySelectorAll('[data-op-source-mode]').forEach(button => {
        const selected = button.dataset.opSourceMode === mode;
        button.setAttribute('aria-pressed', String(selected));
    });
    root.querySelectorAll('[data-source-control]').forEach(control => {
        const hidden = control.dataset.sourceControl !== mode;
        control.hidden = hidden;
        control.setAttribute('aria-hidden', String(hidden));
    });
}

export async function applyCwlFixture(
    fixture,
    {
        refs,
        renderClanSelector,
        refreshClanReport,
        setSelectedPlan,
        setSelectedClan,
        setHelp
    }
) {
    const source = fixture.data?.source;
    if (!source) {
        renderPlanOptions(refs, []);
        setHelp(t('cwl.noSourceHelp'));
        return;
    }
    const clan = source.clan || null;
    if (!clan?.tag) {
        setHelp(t('cwl.fixtureNoClan'), true);
        return;
    }
    setSelectedClan(clan);
    if (source.plan && !source.clan?.standalone) {
        const plan = normalizePlan(source.plan);
        setSelectedPlan(plan);
        renderPlanOptions(refs, [plan]);
        refs.planSelect.value = plan.id;
        renderClanSelector(plan);
        refs.clanSelect.value = clan.tag;
        setSourceMode('plan');
    } else {
        setSelectedPlan(null);
        refs.standaloneInput.value = clan.tag;
        renderStandaloneMode(refs);
        setSourceMode('direct');
    }
    await refreshClanReport(clan);
}
