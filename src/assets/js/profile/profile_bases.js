import { createBaseCard } from "../templates/BaseTemplates.js";
import { postPlayerVerifyTokenRequest } from "../API/API-Player.js";
import { getPlayerWithBattleData } from "../API/API-Functions.js";
import { addBaseToUser } from "../Supabase/Supabase-User.js";
import { getCurrentUserId } from "../utils/user.js";
import { t } from "../i18n/i18n.js";

function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

function profileHasBase(tag) {
    const normalized = normalizeTag(tag);
    return Array.from(document.querySelectorAll('.po-card-base .po-base-info'))
        .some(info => normalizeTag(info.textContent) === normalized);
}

export function loadBases(baseArray, emptyLabel, force = false) {
    if (force) document.querySelectorAll(".po-card-base").forEach(el => el.remove());
    if (!force && document.querySelectorAll(".po-card-base").length > 0) return;
    if (!Array.isArray(baseArray) || baseArray.length === 0) return;
    emptyLabel.classList.add('hidden');
    const showBases = document.querySelector('#po-tab-bases')?.classList.contains('po-tab-active');
    baseArray.forEach(element => {
        createBaseCard(element);
        document.querySelectorAll('.po-card-base').forEach(card => card.classList.toggle('hidden', !showBases));
    });
}

export function handleAddBase(inputBaseTag, inputBaseToken) {
    const userId = getCurrentUserId();
    if (!userId) return Promise.reject(new Error(t('auth.login')));

    const playerId = normalizeTag(inputBaseTag.value);
    const playerToken = inputBaseToken.value.trim();
    if (!playerId || !playerToken) return Promise.reject(new Error(t('profile.accountMissingFields')));
    if (profileHasBase(playerId)) return Promise.reject(new Error(t('profile.accountAlreadyExists')));

    return postPlayerVerifyTokenRequest(playerId, playerToken).then(confirmation => {
        if (confirmation.status === "ok") {
            return getPlayerWithBattleData(playerId).then(playerData => {
                if (profileHasBase(playerData?.[0]?.tag || playerId)) throw new Error(t('profile.accountAlreadyExists'));
                return addBaseToUser(userId, playerData[0]).then(result => {
                    createBaseCard(playerData[0]);
                    return result;
                });
            });
        }
        throw new Error(t('profile.accountVerifyFailed'));
    });
}
