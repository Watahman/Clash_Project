import { t } from '../i18n/i18n.js';
import {
    normalizeImportedReport,
    readOperationReportFile
} from './operation-board-import-export.js';
import { getPlanClans, normalizePlan } from './operation-board-plan-model.js';

export function createOperationBoardImportController({
    refs,
    planStore,
    setSelectedPlan,
    setSelectedClan,
    setLatestReport,
    setCurrentReport,
    cancelReportLoad,
    renderLatestReport,
    renderClanSelector,
    clearReport,
    setState,
    setHelp,
    onImported
}) {
    async function importJsonFile(file) {
        if (!file) return;
        try {
            applyImportedJson(await readOperationReportFile(file));
            setHelp(t('op.importOk'));
        } catch (error) {
            console.error(error);
            setHelp(t('op.importInvalid'), true);
        } finally {
            refs.importFile.value = '';
        }
    }

    function applyImportedJson(data) {
        const report = normalizeImportedReport(data);
        if (report) {
            onImported?.();
            cancelReportLoad();
            setLatestReport(report);
            setCurrentReport(report);
            if (data.plan) setSelectedPlan(normalizePlan(data.plan));
            setSelectedClan(data.clan || report.clan || null);
            renderLatestReport();
            setState('imported');
            return;
        }
        const importedPlan = normalizePlan(data.plan || data);
        if (!importedPlan?.info) throw new Error('Unsupported JSON format');
        onImported?.();
        const id = importedPlan.id || 'imported-json-plan';
        const plan = { ...importedPlan, id };
        planStore.add(plan);
        setSelectedPlan(plan);
        if (!Array.from(refs.planSelect.options).some(item => item.value === id)) {
            const importedOption = document.createElement('option');
            importedOption.value = id;
            importedOption.textContent = `${plan.name} (${t('op.imported')})`;
            refs.planSelect.appendChild(importedOption);
        }
        refs.planSelect.value = id;
        renderClanSelector(plan);
        const clans = getPlanClans(plan);
        if (clans.length) {
            refs.clanSelect.value = clans[0].tag;
            setSelectedClan(clans[0]);
            clearReport(false);
            setHelp(t('op.importPlanOk'));
        }
        setState('imported');
    }

    return { importJsonFile, applyImportedJson };
}
