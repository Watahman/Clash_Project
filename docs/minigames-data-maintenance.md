# Minigames data maintenance

The Entity Guesser uses curated static gameplay identity data. It is deliberately separate from live player and clan API data.

## Daily eligibility

An entity may enter the Daily rotation only when:

- it is permanent Home Village content;
- every field required by its category is present;
- its name, unlock context and gameplay behaviour have been checked against the current live game or an official update note;
- category comparisons are understandable without an image;
- no temporary event modifier changes the stored identity values.

Practice may include recently added content earlier, but incomplete entities must remain excluded entirely.

## Required review after a game update

1. Identify new, removed and balanced content from official release notes.
2. Review affected category definitions before editing individual entities.
3. Verify unlock requirements, housing space, target behaviour, activation type, rarity, building purpose and permanent maximum levels.
4. Check whether merged defenses, Town Hall mechanics or new utility systems changed an entity's category.
5. Run the catalog validation and focused Entity Guesser tests.
6. Manually play one Daily and one Practice round in every changed category.
7. Increment `ENTITY_GUESSER_DATA_VERSION` when saved rounds could otherwise contain stale answers or columns.

## Category rules

- Troops compare identity and deployment properties, not temporary combat buffs.
- Spells compare effect families and clearly equivalent attributes.
- Heroes use fewer attempts because the answer pool is smaller.
- Pets compare their normal behaviour while assigned to a Hero.
- Equipment compares identity properties. Level-dependent effect values belong in a future explicitly levelled comparison mode.
- Defenses compare permanent targeting, range class, attack style and signature mechanics. Do not store temporary Ranked modifiers.
- Resource buildings compare their normal production or storage role rather than changing capacity values.
- Army buildings compare the system they manage, their purpose and unlock context.
- Utility buildings cover permanent Home Village structures that are not primarily army, resource or defense buildings.
- Traps compare normal targets, visibility and effect family. Temporary event traps are excluded.

## Merged and temporary defenses

Permanent merged defenses such as Multi-Archer Tower, Ricochet Cannon, Multi-Gear Tower and Super Wizard Tower are eligible.

Crafted Defenses are deliberately excluded from Daily Mode because their availability, modules and active phase change over time. Add them only through a clearly separate, date-bounded Event Mode.

## Source priority

1. Current live-game information screens.
2. Official Clash of Clans release notes and support pages.
3. A second reliable reference only to flag possible omissions or inconsistencies.

Never promote an entity to Daily eligibility using one unverified community source alone.

## Exclusions

Do not add temporary event troops, temporary spells, temporary Crafted Defenses, unofficial names, artwork-derived hints, audio clues or data copied from a single unverified community source.
