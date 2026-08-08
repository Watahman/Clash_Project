import { createBaseCard } from "../templates/BaseTemplates.js";
import { getPlayerWithBattleData } from "../API/API-Functions.js";
import { addBaseToUser } from "../Supabase/Supabase-User.js";
import { getCurrentUserId } from "../utils/user.js";
import { t } from "../i18n/i18n.js";
import { hideProfileEmptyStateFor } from "./profile_empty_state.js";

const CLASH_TAG_PATTERN = /^#[0289PYLQGRJCUV]{3,15}$/;

function extractTagCandidate(value) {
    let raw = String(value || '').trim();
    if (!raw) return '';

    try {
        if (/^https?:\/\//i.test(raw)) {
            const url = new URL(raw);
            raw = url.searchParams.get('tag') || raw;
        }
    } catch {
        // Fall through and let normal validation reject malformed input.
    }

    try {
        raw = decodeURIComponent(raw);
    } catch {
        // Keep the original value when percent-decoding is not valid.
    }

    return raw.trim().toUpperCase().replace(/O/g, '0').replace(/\s+/g, '');
}

function normalizeTag(value) {
    const tag = extractTagCandidate(value);
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
    if (!CLASH_TAG_PATTERN.test(playerId)) return Promise.reject(new Error(t('profile.accountVerifyFailed')));
    if (profileHasBase(playerId)) return Promise.reject(new Error(t('profile.accountAlreadyExists')));

    return getPlayerWithBattleData(playerId)
        .then(playerData => {
            const base = playerData?.[0];
            if (!base) throw new Error(t('profile.accountVerifyFailed'));
            if (profileHasBase(base.tag || playerId)) throw new Error(t('profile.accountAlreadyExists'));

            return addBaseToUser(userId, base, playerToken).then(result => {
                createBaseCard(base);
                hideProfileEmptyStateFor('po-tab-bases');
                return result;
            });
        })
        .catch(error => {
            if (error?.code === 'ACCOUNT_VERIFICATION_FAILED' || error?.code === 'ACCOUNT_TOKEN_REQUIRED') {
                throw new Error(t('profile.accountVerifyFailed'));
            }
            throw error;
        });
}
