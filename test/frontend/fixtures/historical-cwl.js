export function historicalDetail(season) {
    return {
        season,
        clan: { tag: '#PQL', name: 'ClashPanel' },
        league: { name: 'Master League II' },
        record: { wins: 1, losses: 0, draws: 0 },
        roster: [],
        standings: [],
        wars: [],
        dataQuality: 'Partial history'
    };
}

export function historicalFullDetail(season) {
    return {
        ...historicalDetail(season),
        record: { wins: 6, losses: 1, draws: 0 },
        roster: [{ tag: '#P0L', name: 'Alex', townHall: 17 }],
        standings: [
            { rank: 1, tag: '#PQL', name: 'ClashPanel' },
            { rank: 2, tag: '#ENEMY', name: 'Opponent' }
        ],
        wars: [{
            day: 1,
            id: '#WAR',
            state: 'completed',
            result: 'win',
            teamSize: 1,
            attacksPerMember: 1,
            detailsComplete: true,
            clan: side('#PQL', '#P0L', '#E1', 3, 100),
            opponent: side('#ENEMY', '#E1', '#P0L', 2, 88)
        }],
        dataQuality: 'Complete',
        warDetailsComplete: true
    };
}

function side(tag, memberTag, targetTag, stars, destruction) {
    return {
        tag,
        stars,
        destruction,
        attacks: 1,
        members: [{
            tag: memberTag,
            name: memberTag === '#P0L' ? 'Alex' : 'Luna',
            townHall: 17,
            attacks: [{
                attackerTag: memberTag,
                defenderTag: targetTag,
                stars,
                destruction,
                order: 1
            }]
        }]
    };
}
