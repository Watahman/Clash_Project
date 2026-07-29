import * as config from '../Data/config.js';
import { databaseRequestWithBody } from './Supabase-Client.js';

export async function getWarAssignments(clanTag, warKey) {
    const rows = await databaseRequestWithBody(
        config._BASE_URL + config._EXT_SUPA_WAR_ASSIGNMENTS_GET,
        { clanTag, warKey }
    );
    return (Array.isArray(rows) ? rows : []).map(normalizeAssignment);
}

export async function setWarAssignment(clanTag, warKey, assignment) {
    const result = await databaseRequestWithBody(
        config._BASE_URL + config._EXT_SUPA_WAR_ASSIGNMENT_SAVE,
        { clanTag, warKey, ...assignment }
    );
    return normalizeAssignment(result);
}

export async function deleteWarAssignment(assignmentId) {
    return databaseRequestWithBody(
        config._BASE_URL + config._EXT_SUPA_WAR_ASSIGNMENT_DELETE,
        { assignmentId }
    );
}

function normalizeAssignment(row = {}) {
    return {
        id: row.id,
        playerTag: row.playerTag || row.player_tag,
        attackSlot: Number(row.attackSlot || row.attack_slot),
        type: row.type || row.assignment_type,
        targetPosition: row.targetPosition ?? row.target_position ?? null,
        updatedAt: row.updatedAt || row.updated_at
    };
}
