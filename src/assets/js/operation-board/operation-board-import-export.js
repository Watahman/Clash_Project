import { buildRankingHistory } from '../cwl/cwl-ranking-history.js?v=20260829-public-auth-v1';
import { createEmptyRound } from './operation-board-roster-model.js';
import { buildStandings } from './operation-board-standings-model.js';
import {
    normalizeTag,
    number
} from './operation-board-utils.js';

export function exportOperationReport(report) {
    const data = report || { message: 'No report loaded' };
    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'clashpanel-cwl-operation-report.json';
    anchor.click();
    URL.revokeObjectURL(url);
}

export function readOperationReportFile(file) {
    if (!file) return Promise.reject(new Error('No JSON file selected'));
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                resolve(JSON.parse(String(reader.result || '')));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error || new Error('Unable to read JSON file'));
        reader.readAsText(file);
    });
}

export function normalizeImportedReport(data) {
    if (!data || typeof data !== 'object') return null;
    if (!Array.isArray(data.roster) || !Array.isArray(data.rounds)) return null;

    const leagueWars = Array.isArray(data.leagueWars)
        ? data.leagueWars
        : Array.isArray(data.wars)
            ? data.wars
            : [];
    const selectedClanTag = data.clan?.tag || '';
    const standings = data.standings
        || buildStandings(leagueWars, selectedClanTag);
    const rankingHistory = buildRankingHistory({
        leagueGroup: data.leagueGroup,
        leagueWars,
        selectedClanTag,
        buildStandings
    });
    return {
        ...data,
        roster: data.roster
            .map(player => ({
                ...player,
                tag: normalizeTag(player.tag),
                name: player.name || normalizeTag(player.tag),
                townHall: number(player.townHall || player.townHallLevel, 0),
                dayStats: player.dayStats || {}
            }))
            .filter(player => player.tag),
        rounds: data.rounds.map((round, index) => {
            const state = round.state === 'notAvailable'
                ? 'notStarted'
                : round.state || 'notStarted';
            return {
                ...createEmptyRound(index + 1),
                ...round,
                day: round.day || index + 1,
                state,
                result: round.result === 'notAvailable'
                    ? 'notStarted'
                    : round.result || 'notStarted'
            };
        }),
        wars: Array.isArray(data.wars) ? data.wars : [],
        leagueWars,
        standings,
        rankingHistory,
        phase: data.phase || 'unknown'
    };
}
