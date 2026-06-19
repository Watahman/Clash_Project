import { createBaseCard } from "../templates/BaseTemplates.js";
import { postPlayerVerifyTokenRequest } from "../API/API-Player.js";
import { getPlayerWithBattleData } from "../API/API-Functions.js";
import { addBaseToUser } from "../Supabase/Supabase-User.js";
import { getCurrentUserId } from "../utils/user.js";

export function loadBases(baseArray, emptyLabel, force = false) {
    if (force) document.querySelectorAll(".po-card-base").forEach(el => el.remove());
    if (!force && document.querySelectorAll(".po-card-base").length > 0) return;
    if (!Array.isArray(baseArray) || baseArray.length === 0) return;
    emptyLabel.classList.add('hidden');
    baseArray.forEach(element => { createBaseCard(element); });
}

export function handleAddBase(inputBaseTag, inputBaseToken) {
    const userId = getCurrentUserId();
    if (!userId) return;

    const playerId = inputBaseTag.value.trim();
    const playerToken = inputBaseToken.value.trim();
    if (!playerId || !playerToken) return;

    postPlayerVerifyTokenRequest(playerId, playerToken).then(confirmation => {
        if (confirmation.status === "ok") {
            getPlayerWithBattleData(playerId).then(playerData => {
                createBaseCard(playerData[0]);
                addBaseToUser(userId, playerData[0])
                    .then(confirm => { console.log(confirm); })
                    .catch(error => console.error(error));
            });
        }
    }).catch(error => console.error(error));
}
