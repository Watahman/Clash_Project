import { buildRankingHistory } from '../cwl/cwl-ranking-history.js';
import { buildRosterModel } from './operation-board-roster-model.js';
import { buildStandings } from './operation-board-standings-model.js';

export function buildReport(raw) {
    const { roster, rounds } = buildRosterModel(raw);
    const standings = buildStandings(raw.leagueWars || raw.wars || [], raw.clan?.tag);
    const rankingHistory = buildRankingHistory({
        leagueGroup: raw.leagueGroup,
        leagueWars: raw.leagueWars || [],
        selectedClanTag: raw.clan?.tag,
        buildStandings
    });
    return {
        ...raw,
        roster,
        rounds,
        standings,
        rankingHistory
    };
}
