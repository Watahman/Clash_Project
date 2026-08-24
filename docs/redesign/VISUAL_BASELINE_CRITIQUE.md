# Pre-redesign visual critique

The evidence set in `baseline-old/`, the authenticated captures in `part-1` through `part-5`, and `final/` show a functioning but incomplete system.

## Confirmed strengths

- Workspace shell and primary tasks already have a stable, readable layout.
- Dark surfaces, restrained gold and compact navigation are a useful starting point.
- The public homepage has confident Clash imagery and a clear primary action.

## Redesign priorities

1. The workspace still presents ClashPanel as a CWL workspace. Its taxonomy hides the broader Manage, Plan, Compete, Play and Progress suite.
2. Dashboard and Planner use large empty surfaces and thin row lists where richer, honest context and next actions are needed.
3. Hierarchy is too uniform: most areas use similar dark panels, dividers and muted labels, so priority and module identity are difficult to scan.
4. Page-specific navigation injection creates visible and architectural drift for Advanced Stats and Achievements.
5. The public homepage is visually stronger than the product, but its repeated full-hero capture and marketing-first composition do not establish the real multi-module product.
6. Mobile must use deliberate data layouts, 44px targets and sheets; shrinking the desktop tables/canvas is not sufficient.
7. Existing patch stylesheets make ownership unclear and invite local overrides instead of one shared system.
8. The asset library is not yet consumed through one fallback-safe resolver, making recognition and game identity inconsistent.

## Quality bar

Each major module must prove clear first action, complete loading/empty/error/rich states, dark/light behavior, keyboard access, and real desktop/tablet/mobile rendering before it is accepted.
