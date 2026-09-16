# Asset sources

ClashPanel keeps source/provenance notes next to the bundled game assets so future asset refreshes do not have to reconstruct where files came from.

| Asset/category | Source | Policy / notes |
| --- | --- | --- |
| Clash entity raster assets | `clash-of-clans-data` package by chiefpansancolt | Package code/data is MIT; underlying Clash imagery remains Supercell intellectual property and is used subject to the Supercell Fan Content Policy. |
| Fan-content framework | Supercell Fan Kit and Fan Content Policy | ClashPanel must remain clearly unofficial and must not imply Supercell endorsement. |
| ClashPanel utility SVGs | Created for ClashPanel | Project-owned UI assets; most are designed to inherit `currentColor`. |
| Dynamic clan badges | Clash of Clans API at runtime | Intentionally not stored as a static local asset set. |

`scripts/collect-clash-assets.mjs` records the upstream package version and entity count in the generated game-asset `manifest.json`. It no longer creates a separate historical Markdown collection report.
