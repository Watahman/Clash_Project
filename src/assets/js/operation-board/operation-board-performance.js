import {
    applyCwlPredictions,
    collectPredictionPlayerTags
} from '../cwl/cwl-performance-prediction.js';
import {
    loadPlayerPerformanceBatch
} from '../cwl/player-performance-client.js';
import {
    getWarSide,
    normalizeTag,
    number
} from './operation-board-utils.js';

export async function enrichWithHistoricalPerformance(report) {
    const tags = collectPredictionPlayerTags(report);
    const results = await loadPlayerPerformanceBatch(tags);
    const townHallByTag = collectTownHalls(report);
    const insights = new Map(tags.map(tag => {
        const historical = results[tag];
        return [
            tag,
            historicalInsight(historical, townHallByTag.get(tag))
        ];
    }));
    return {
        ...applyCwlPredictions(report, insights),
        historicalPerformance: results
    };
}

function collectTownHalls(report) {
    const townHalls = new Map(
        (report.roster || []).map(player => [
            normalizeTag(player.tag),
            number(player.townHall, 0)
        ])
    );
    (report.wars || []).forEach(war => {
        const side = getWarSide(war, report.clan?.tag);
        [side?.self, side?.opponent].forEach(clan => {
            (clan?.members || []).forEach(member => {
                const tag = normalizeTag(member.tag);
                const townHall = number(
                    member.townhallLevel || member.townHallLevel,
                    0
                );
                if (tag && townHall) townHalls.set(tag, townHall);
            });
        });
    });
    return townHalls;
}

function historicalInsight(historical, townHall) {
    const ready = historical?.status === 'ready';
    return {
        townHall: number(townHall, 0),
        progression: 0.5,
        offense: {
            count: ready ? number(historical.attackCount, 0) : 0,
            stars: ready ? historical.avgStars : null,
            destruction: ready ? historical.avgDestruction : null
        },
        defense: {
            count: 0,
            stars: null,
            destruction: null
        },
        army: {
            sampleSize: 0,
            share: 0.5
        },
        historical: historical || null
    };
}
