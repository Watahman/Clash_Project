import { t } from '../i18n/i18n.js';

export function refreshPlannerPriorityLabels(root = document) {
    const playerLabel = t('planner.playerPriority');
    root.querySelectorAll('.cwl-player-priority').forEach(select => {
        const selected = select.value;
        Array.from(select.options).forEach(option => {
            option.textContent = t(`planner.playerPriority${capitalize(option.value)}`);
        });
        select.value = selected;
        select.title = playerLabel;
        select.setAttribute('aria-label', playerLabel);
    });

    const clanLabel = t('planner.clanPriority');
    root.querySelectorAll('.cwl-clan-priority').forEach(label => {
        const select = label.querySelector('select');
        const labelText = label.querySelector('span');
        if (labelText) labelText.textContent = clanLabel;
        if (!select) return;
        const selected = select.value;
        Array.from(select.options).forEach(option => {
            option.textContent = t(`planner.clanPriority${capitalize(option.value)}`);
        });
        select.value = selected;
        select.title = clanLabel;
        select.setAttribute('aria-label', clanLabel);
    });
}

function capitalize(value) {
    const normalized = String(value || '');
    return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : '';
}
