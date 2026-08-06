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
3. Verify unlock requirements, housing space, target behaviour, activation type, rarity and permanent maximum levels.
4. Run the catalog validation and focused Entity Guesser tests.
5. Manually play one Daily and one Practice round in every changed category.
6. Increment `ENTITY_GUESSER_DATA_VERSION` when saved rounds could otherwise contain stale answers or columns.

## Category rules

- Troops compare identity and deployment properties, not temporary combat buffs.
- Spells compare effect families and clearly equivalent attributes.
- Heroes use fewer attempts because the answer pool is smaller.
- Pets compare their normal behaviour while assigned to a Hero.
- Equipment compares identity properties. Level-dependent effect values belong in a future explicitly levelled comparison mode.

## Exclusions

Do not add temporary event troops, temporary spells, unofficial names, artwork-derived hints, audio clues or data copied from a single unverified community source.
