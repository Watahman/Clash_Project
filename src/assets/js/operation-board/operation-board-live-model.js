import {
    decideWarResult,
    normalizeWarState
} from '../cwl/cwl-war-state.js';
import {
    getWarSide,
    number
} from './operation-board-utils.js';

export function buildLiveView(report) {
    if (!report) return null;
    const context = getCurrentWarContext(report);
    const { war, side, round } = context;
    if (!war && !round) return null;

    const state = context.state;
    const own = sideStats(side?.self, war?.attacksPerMember);
    const opponent = sideStats(side?.opponent, war?.attacksPerMember);
    const result = state === 'completed' && side
        ? decideWarResult(
            own.stars,
            own.destruction,
            opponent.stars,
            opponent.destruction,
            state
        )
        : round?.result || 'notAvailable';
    return {
        day: context.day,
        state,
        result,
        own: {
            tag: side?.self?.tag || report.clan?.tag || '',
            name: side?.self?.name || report.clan?.name || report.clan?.tag || '-',
            stars: side ? own.stars : number(round?.stars, 0),
            destruction: side ? own.destruction : number(round?.destruction, 0),
            attacksUsed: side ? own.attacksUsed : number(round?.attacksUsed, 0),
            availableAttacks: side
                ? own.availableAttacks
                : number(round?.availableAttacks, 0),
            remainingAttacks: side
                ? own.remainingAttacks
                : Math.max(
                    0,
                    number(round?.availableAttacks, 0)
                        - number(round?.attacksUsed, 0)
                )
        },
        opponent: {
            tag: side?.opponent?.tag || '',
            name: side?.opponent?.name || round?.opponent || '-',
            ...opponent
        },
        startTime: war?.startTime || null,
        endTime: war?.endTime || null
    };
}

export function getCurrentCwlDay(report) {
    return buildLiveView(report)?.day || null;
}

export function getCurrentWarContext(report) {
    const war = selectWar(report?.wars || []);
    const side = war ? getWarSide(war, report?.clan?.tag) : null;
    const round = selectRound(report?.rounds || [], war?._round);
    return {
        war,
        side,
        round,
        state: war ? normalizeWarState(war) : round?.state || 'unknown',
        day: number(war?._round || round?.day, 0)
    };
}

function selectWar(wars) {
    return wars.find(war => normalizeWarState(war) === 'live')
        || wars.find(war => normalizeWarState(war) === 'preparation')
        || [...wars].reverse().find(war => normalizeWarState(war) === 'completed')
        || null;
}

function selectRound(rounds, warRound) {
    if (warRound) return rounds.find(round => round.day === warRound) || null;
    return rounds.find(round => round.state === 'live')
        || rounds.find(round => round.state === 'preparation')
        || [...rounds].reverse().find(round => round.state === 'completed')
        || null;
}

function sideStats(side, attacksPerMember = 1) {
    const members = Array.isArray(side?.members) ? side.members : [];
    const attacksUsed = Number.isFinite(Number(side?.attacks))
        ? number(side.attacks, 0)
        : members.reduce(
            (sum, member) => sum + (Array.isArray(member.attacks)
                ? member.attacks.length
                : 0),
            0
        );
    const availableAttacks = members.length
        * Math.max(1, number(attacksPerMember, 1));
    return {
        stars: side ? number(side.stars, 0) : null,
        destruction: side ? number(side.destructionPercentage, 0) : null,
        attacksUsed,
        availableAttacks,
        remainingAttacks: Math.max(0, availableAttacks - attacksUsed)
    };
}
