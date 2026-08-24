# Pre-redesign baseline notes

Captured automatically on 2026-08-11 from `redesign/clashpanel-v2` before shared redesign implementation.

## Automated captures

The `baseline-old` tree contains full-page 1440×1000 and 390×844 captures for:

- homepage;
- public CWL Planner, CWL Tracker and Clan Management pages;
- Minigames and public Bracket page;
- Guides, Methodology, About and Changelog;
- Login and Register;
- Privacy, Cookies, Terms and Contact.

The browser had no authenticated local session. Direct workspace navigation correctly redirected to Login, so no fake login or production credentials were introduced for baseline collection.

## Existing authenticated evidence retained

The selected functional base already contains authenticated/current-state captures under:

- `docs/redesign/part-1/` — shell, homepage and auth;
- `docs/redesign/part-2/` — Dashboard and Saved Plans empty states;
- `docs/redesign/part-3/` — Planner desktop/mobile;
- `docs/redesign/part-4/` — CWL Operation Board desktop/mobile;
- `docs/redesign/part-5/` — Clan Family desktop/mobile;
- `docs/redesign/final/` — Dashboard, Planner, Operation Board, Clan Family, Profile, Bracket and homepage review captures.

These images are regression evidence only. They preserve controls, hierarchy and states that existed before V2; they are not the visual target.

## Remaining deterministic coverage

The development-only fixture adapter and 57-scenario catalog must provide rich authenticated states without real user data. Final screenshots will be captured from those real page/view-model boundaries after module integration.
