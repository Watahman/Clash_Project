# Branch Audit Note

## Repository and audit date

- Repository: `Watahman/Clash_Project`
- Active checkout: `C:\Users\Emile\IdeaProjects\Clash_Project`
- Audited: 2026-08-11
- Dedicated redesign branch: `redesign/clashpanel-v2`
- Selected base: `agent/advanced-stats-foundation`
- Base commit: `8745eaf93d933aa15c27b1aeeda04979c041de13`

## Branches compared after fetch/prune

The selected base was compared with:

- `origin/Development` — selected base has 332 unique commits; Development has one unique CI-removal commit.
- `origin/master` — selected base has 445 unique commits; master has one unique CI-removal commit.
- `origin/agent/advanced-achievements-foundation` — selected base has 393 unique commits; the other branch has one unique CI-removal commit.
- `origin/agent/minigames-entity-guesser-foundation` — selected base has 391 unique commits; the other branch has one unique CI-removal commit.
- `origin/agent/bracket-generator-redesign` — selected base has 444 unique commits; the other branch has one unique CI-removal commit.
- `origin/agent/war-board-webby-redesign` — selected base has 443 unique commits; the other branch has one unique CI-removal commit.
- `origin/integration/development-into-advanced-stats` — selected base has 328 unique commits; the other branch has one unique CI-removal commit.

Each compared branch's only unique commit removes `.github/workflows/ci.yml`. The selected base already contains no tracked `.github/workflows` files, so no CI-removal cherry-pick is required and GitHub Actions remains disabled.

## Functional decision

`agent/advanced-stats-foundation` is the verified functional superset for this redesign. Its tree contains the current Advanced Stats lifecycle, expanded Achievements, Entity Guesser and Higher or Lower, the regular War Board, the CWL operation/history/bonuses stack, Planner Auto Plan and Optimize Plan, Clan Family management, Friends/profile flows, and the real bracket engine.

The public and workspace bracket pages still describe the tool as coming soon even though the local engine supports generation, BYEs, winner propagation, champion state, persistence, JSON import/export, and reset. That mismatch is redesign work, not a reason to select an older branch.

## Local asset work retained

The prepared asset library was present as untracked content in the selected checkout. It includes the central manifest, 274 WebP assets, module/UI SVG sets, fallbacks, collection scripts, source records, and licence/provenance material. A recovery archive was created before branch creation:

`C:\Users\Emile\Downloads\ClashPanel-assets-untracked-backup-20260811.zip`

SHA-256: `598DA5A4F7A50BA4EA37A80AE4CA499CBD4F8019163D1EFD528864E39DEC06D2`

The assets are intentionally retained on `redesign/clashpanel-v2`. Their manifest URL/category normalization is part of the shared-foundation work.

## Safety state

- Work continues only on `redesign/clashpanel-v2` and later isolated redesign worktrees.
- No production branch is merged.
- Nothing is pushed or deployed automatically.
- GitHub Actions is not reintroduced.
- Existing unrelated worktrees remain untouched.
