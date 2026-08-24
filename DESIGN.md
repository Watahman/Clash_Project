# ClashPanel design contract

ClashPanel is a broad Clash of Clans product suite built around five pillars: **Manage**, **Plan**, **Compete**, **Play**, and **Progress**. The interface is professional, restrained, product-led, information-clear, dark/light capable, and uses game personality as context rather than decoration. It is not a global war room, esports overlay, childish game UI, or generic AI dashboard.

## Palette

Dark tokens: background `#0A0E13`, elevated background `#0E141B`, surfaces `#121A23 / #17212C / #1D2935`, hover `#202D3A`; text `#F3F6F9 / #AAB5C2 / #758191`; brand `#D8AC55`, hover `#E7C576`, strong `#F2D48F`; success `#62C693`, warning `#E1A95F`, danger `#E07373`, info `#65A7E8`.

Light tokens: background `#F3F4F1`, elevated background `#ECEEEA`, surfaces `#FFFFFF / #F8F8F5 / #EEF1EC`, hover `#E9ECE7`; text `#17202A / #5E6975 / #7A858F`; brand `#8D651E`, hover `#745015`, strong `#68470F`; success `#2D8458`, warning `#95631E`, danger `#B04D4D`, info `#3578B8`.

Pillar accents are indicators, not page backgrounds: Manage `#62B8A6`, Plan `#D8AC55`, Compete `#DD7E66`, Play `#8F83E8`, Progress `#62A6D9` (light: `#377F73 / #8D651E / #A85645 / #6658B6 / #3578B8`). The global primary action remains brand gold.

## Type and rhythm

- Manrope for headings; Inter for UI/body; JetBrains Mono only for tags, IDs, and codes.
- Public display sizes use the repository tokens from `system/typography.css`. Workspace H1 is 32px desktop, 28px tablet, 24px mobile, weight 760; H2 22px/720; H3 16px/700; body 14–15px at 1.55–1.65.
- Spacing is only `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`.
- Controls use 8px radius, compact cards 10px, panels 12px, feature blocks 16px, hero media 18px, pills 999px.
- Use 1px quiet borders. Apply shadows only to raised/floating layers, never every card.

## Dimensions

- Buttons are 40px high; large CTAs 48px; icon buttons 40×40; inputs/selects 42px.
- Workspace sidebar is 248px expanded and 72px collapsed; topbar 64px. It becomes an overlay below 900px.
- Public header is 72px; public max width 1280px. Workspace content defaults to 1440px with 32px padding, or 16px on mobile.
- Minimum touch target is 44px on mobile.

## Motion

Use `cubic-bezier(.2,.8,.2,1)` for standard motion and `cubic-bezier(.22,1,.36,1)` for emphasis. Micro interactions last 120–160ms, panels/tabs 200–240ms, page reveals 280–340ms, and important changes 350–450ms. Cards may translate up 2px with a stronger border, never scale aggressively. Drawers enter from 10px, modals from 8px. Respect `prefers-reduced-motion` and never make motion necessary for comprehension.

## Components

- Cards expose one useful grouping or action; do not wrap every section in a card.
- Tables use 44px headers, 48–56px rows, separators rather than cell grids, and structured mobile lists where horizontal scrolling would obstruct the primary task.
- Tabs are 40px with selected text and one 2px module-colored underline.
- Forms have explicit labels, plain-language help and errors, visible focus, and never rely on placeholder text as a label.
- Drawers are 360px normally or 440px for complex work, full-height sheets on mobile; modals are for confirmation/create/import. Both require focus management and safe Escape handling.
- Badges are 24px high and semantic. Empty states say what is missing, why it matters, and what action to take.
- Charts use restrained brand/pillar/semantic lines, accessible tooltips, low-opacity grids, and preserve real missing-data gaps.
- Destructive actions remain ghost/secondary until final confirmation.
- Game images come through the central entity resolver. Dynamic clan badges remain API-provided with a local fallback.

## Navigation and identity

Workspace navigation is exactly: Home (Dashboard, Explore), Manage (Clan Family), Plan (CWL Planner, Saved Plans), Compete (CWL Tracker, War Board, Brackets), Play (Games), Progress (Advanced Stats, Achievements). Hide unavailable items instead of advertising placeholders. The brand subline is “Tools & community”.

## Anti-patterns

No neon primary branding; glassmorphism everywhere; giant rounded cards everywhere; excessive glow; gold on every surface; random gradients; global battle-room identity; fake metrics; decorative artwork replacing product UI; excessive animation; emoji icons; or module-specific competing design systems.
