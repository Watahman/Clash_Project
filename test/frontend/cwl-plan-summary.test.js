import { describe, expect, it } from 'vitest';
import { summarizePlan } from '../../src/assets/js/cwl/cwl-plan-summary.js';

describe('CWL plan summaries', () => {
    it('uses real plan contents for clan and free-player counts', () => {
        const summary = summarizePlan({
            id: 'plan-1',
            name: 'Juli',
            updatedAt: '2026-07-18T10:00:00Z',
            isOwner: false,
            info: {
                freePlayers: [
                    { tag: '#AAA', name: 'A' },
                    { tag: '#BBB', name: 'B' }
                ],
                clans: [
                    { tag: '#CCC', name: 'Clan', players: [] }
                ]
            }
        });

        expect(summary).toMatchObject({
            id: 'plan-1',
            name: 'Juli',
            clanCount: 1,
            freePlayerCount: 2,
            updatedAt: '2026-07-18T10:00:00Z',
            isOwner: false
        });
    });
});
