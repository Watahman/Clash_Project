# ClashPanel Asset Pack

This pack follows the ClashPanel Asset Collection Guide.

## Already included

- Complete target folder structure.
- Original ClashPanel utility SVG set:
  - UI icons
  - Manage / Plan / Compete / Play / Progress
  - Achievement category icons
  - Stats semantic icons
  - War/competition semantic icons
  - Game mechanic icons
- Fallback SVGs.
- Central manifest scaffold.
- Asset provenance file.
- Automated raster-asset collector.

## Collect the real Clash entity images

From the root of your ClashPanel project, copy this pack's `scripts/` and `src/assets/` folders into the project, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\collect-assets.ps1
```

The collector downloads `clash-of-clans-data@0.16.0`, reads its Home Village JSON, copies/normalizes the relevant entity artwork, corrects file extensions based on actual file bytes, builds `src/assets/game/manifest.json`, and writes a collection report.

It targets:

- Town Halls
- Troops
- Super Troops
- Spells
- Siege Machines
- Heroes
- Pets
- Hero Equipment
- Buildings
- Defenses
- Traps
- League imagery found in the package

Dynamic clan badges are intentionally excluded.

## Why the collector exists

The ChatGPT file runtime used to build this bundle cannot reliably bulk-download all binary files from npm/GitHub. The collector does the bulk binary retrieval directly on your machine while retaining the exact asset organization, provenance, and normalization rules from the guide.

## After running it

Review:

```text
src/assets/game/manifest.json
src/assets/sources/COLLECTION_REPORT.md
```

Then the redesign agents should consume images through a central resolver rather than hardcoded paths.
