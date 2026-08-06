# Minigames data maintenance

The minigames use curated static gameplay identity data. This data is deliberately separate from live player and clan API data.

## Current implementation scope

The shared catalog contains ten playable categories and 163 curated entities:

- Home Village troops;
- Home Village spells;
- Heroes;
- Hero Pets;
- Hero Equipment;
- permanent defenses;
- resource buildings;
- army buildings;
- utility buildings;
- traps.

The catalog currently powers:

- Entity Guesser, phases 1 through 2B;
- Higher or Lower, phase 3A.

Phase 3A means the complete Daily and Practice game loop is present, but advanced level-dependent combat comparisons, account synchronization and global leaderboards are not yet included.

## Daily eligibility

An entity may enter a Daily rotation only when:

- it is permanent Home Village content;
- every field required by its category is present;
- its name, unlock context and gameplay behaviour have been checked against the current live game or an official update note;
- the comparison is understandable without an image;
- no temporary event modifier changes the stored identity values.

Practice may include recently added content earlier, but incomplete entities must remain excluded entirely.

## Required review after a game update

1. Identify new, removed and balanced content from official release notes.
2. Review affected category definitions before editing individual entities.
3. Verify unlock requirements, housing space, target behaviour, activation type, rarity, building purpose and permanent maximum levels.
4. Check whether merged defenses, Town Hall mechanics or new utility systems changed an entity's category.
5. Rebuild every affected Higher or Lower pair and confirm that tied values remain excluded.
6. Run the catalog, Entity Guesser and Higher or Lower tests.
7. Manually play one Daily and one Practice round in every changed category.
8. Increment the relevant data version when saved rounds could otherwise contain stale answers or columns.

## Entity Guesser category rules

- Troops compare identity and deployment properties, not temporary combat buffs.
- Spells compare effect families and clearly equivalent attributes.
- Heroes use fewer attempts because the answer pool is smaller.
- Pets compare their normal behaviour while assigned to a Hero.
- Equipment compares identity properties.
- Defenses compare permanent targeting, range class, attack style and signature mechanics. Do not store temporary Ranked modifiers.
- Resource buildings compare their normal production or storage role rather than changing capacity values.
- Army buildings compare the system they manage, their purpose and unlock context.
- Utility buildings cover permanent Home Village structures that are not primarily army, resource or defense buildings.
- Traps compare normal targets, visibility and effect family. Temporary event traps are excluded.

## Higher or Lower rules

Every question must compare two entities from the same category using the same field definition and unit.

Current eligible comparison fields are:

- troop housing space and Town Hall unlock;
- spell housing space and broad unlock stage;
- Hero Town Hall unlock and supported equipment count;
- Hero Pet Town Hall unlock and Pet House requirement;
- Hero Equipment permanent maximum level;
- defense Town Hall unlock and range class;
- resource-building Town Hall unlock;
- army-building Town Hall unlock and footprint;
- utility-building Town Hall unlock and footprint;
- trap Town Hall unlock and effect-area class.

The first value is shown. The second value remains hidden until the player chooses Higher or Lower.

Rules:

- equal-value pairs are never generated;
- the exact metric and unit are always visible;
- a Daily contains ten questions, one from each category;
- the Daily is deterministic from the UTC date;
- Practice may be filtered by category and has no Daily score impact;
- question results never depend on temporary boosts or player-specific levels.

## Higher or Lower scoring

- Every correct answer gives 100 base points.
- Correct-answer combo 3–4 adds 10 points per answer.
- Combo 5–7 adds 20 points per answer.
- Combo 8–10 adds 30 points per answer.
- A wrong answer gives 0 points and resets the combo.
- Ten correct answers produce the maximum Daily score of 1,170.
- The result shares only correct/incorrect symbols, score and best combo; it never reveals question answers.

## Level-dependent combat data

HP, DPS, damage per hit, healing, duration and percentage effects are not yet eligible for Higher or Lower.

They may be added only after every value includes:

- an exact entity level;
- the relevant Town Hall, Laboratory, Hero Hall, Pet House or Blacksmith context;
- a unit;
- a verification date;
- the game update against which it was checked.

Never compare a current maximum value without showing what “maximum” means for both entities.

## Merged and temporary defenses

Permanent merged defenses such as Multi-Archer Tower, Ricochet Cannon, Multi-Gear Tower and Super Wizard Tower are eligible.

Crafted Defenses are deliberately excluded from Daily Mode because their availability, modules and active phase change over time. Add them only through a clearly separate, date-bounded Event Mode.

## Source priority

1. Current live-game information screens.
2. Official Clash of Clans release notes and support pages.
3. A second reliable reference only to flag possible omissions or inconsistencies.

Never promote an entity or comparison to Daily eligibility using one unverified community source alone.

## Exclusions

Do not add temporary event troops, temporary spells, temporary Crafted Defenses, unofficial names, artwork-derived hints, audio clues or data copied from a single unverified community source.
