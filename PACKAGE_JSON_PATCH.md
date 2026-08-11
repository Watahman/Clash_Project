# package.json addition

Add this script inside the existing `"scripts"` object:

```json
"verify:redesign": "node scripts/redesign/verify-redesign.mjs"
```

Usage:

```text
npm run verify:redesign
```

Fast mode:
- structural HTML checks;
- local references;
- asset manifest;
- noindex sanity;
- public meta sanity;
- GitHub Actions presence warning;
- existing `dist/` sanity if present.

Full local mode:

```text
node scripts/redesign/verify-redesign.mjs --full
```

This additionally runs the repository's existing:
- `check:casing`;
- `check:endpoints`;
- `check:migrations`;
- `build`;
- `check:static`;
- `check:seo`.

It intentionally does **not** run the full test suite unless you explicitly add:

```text
--tests
```

It never deploys and does not create GitHub Actions.
