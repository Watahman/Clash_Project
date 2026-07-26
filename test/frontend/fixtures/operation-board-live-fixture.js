export function recommendationReport() {
    const performance = {
        status: 'ready',
        confidence: 'High',
        attackCount: 24,
        avgStars: 2.55,
        avgDestruction: 90,
        tripleRate: 60,
        twoStarRate: 36,
        lowStarRate: 4
    };
    return {
        clan: { tag: '#SELF', name: 'ClashPanel' },
        rounds: [{ day: 4, state: 'live', result: 'pending' }],
        historicalPerformance: {
            '#THOMAS': performance,
            '#OPEN': performance,
            '#ENEMYREADY': performance
        },
        wars: [{
            _round: 4,
            state: 'inWar',
            attacksPerMember: 1,
            clan: {
                tag: '#SELF',
                name: 'ClashPanel',
                stars: 3,
                destructionPercentage: 92,
                attacks: 1,
                members: [{
                    tag: '#USED',
                    name: 'Used',
                    mapPosition: 1,
                    townhallLevel: 17,
                    attacks: [
                        {
                            defenderTag: '#CLOSED',
                            stars: 3,
                            destructionPercentage: 100
                        },
                        {
                            defenderTag: '#OPEN',
                            stars: 2,
                            destructionPercentage: 84
                        }
                    ]
                }, {
                    tag: '#THOMAS',
                    name: 'Thomas',
                    mapPosition: 2,
                    townhallLevel: 17,
                    attacks: []
                }]
            },
            opponent: {
                tag: '#ENEMY',
                name: 'Enemy',
                stars: 2,
                destructionPercentage: 78,
                attacks: 1,
                members: [{
                    tag: '#CLOSED',
                    name: 'Closed',
                    mapPosition: 1,
                    townhallLevel: 17,
                    attacks: [{
                        defenderTag: '#USED',
                        stars: 2,
                        destructionPercentage: 78
                    }]
                }, {
                    tag: '#OPEN',
                    name: 'Open',
                    mapPosition: 2,
                    townhallLevel: 17,
                    attacks: []
                }, {
                    tag: '#ENEMYREADY',
                    name: 'Enemy ready',
                    mapPosition: 3,
                    townhallLevel: 17,
                    attacks: []
                }]
            }
        }]
    };
}
