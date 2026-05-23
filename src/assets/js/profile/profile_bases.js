import { createBaseCard } from "../templates/BaseTemplates.js";
import { postPlayerVerifyTokenRequest } from "../API/API-Player.js";
import { getPlayerWithBattleData } from "../API/API-Functions.js";
import { addBaseToUser } from "../Supabase/Supabase-User.js";
import { getCurrentUserId } from "../utils/user.js";

export function loadBases(baseArray, emptyLabel) {
    if (document.querySelectorAll(".po-card-base").length > 0) return;
    if (baseArray.length === 0) return;
    emptyLabel.classList.add('hidden');
    baseArray.forEach(element => { createBaseCard(element); });
}

export function handleAddBase(inputBaseTag, inputBaseToken) {
    const playerId = inputBaseTag.value;
    const playerToken = inputBaseToken.value;
    postPlayerVerifyTokenRequest(playerId, playerToken).then(confirmation => {
        if (confirmation.status === "ok") {
            getPlayerWithBattleData(playerId).then(playerData => {
                createBaseCard(playerData[0]);
                addBaseToUser(getCurrentUserId(), playerData[0])
                    .then(confirm => { console.log(confirm); });
            });
        }
    });
}
