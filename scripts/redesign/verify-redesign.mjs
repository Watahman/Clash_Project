#!/usr/bin/env node
/**
 * ClashPanel redesign sanity verifier.
 *
 * Goals:
 * - LOCAL only
 * - no deployment
 * - no GitHub Actions
 * - cheap structural checks by default
 * - optional --full mode for existing repository checks/tests
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const full = process.argv.includes('--full');

let failures = 0;
let warnings = 0;

const ok = msg => console.log(`✓ ${msg}`);
const warn = msg => { warnings += 1; console.warn(`⚠ ${msg}`); };
const fail = msg => { failures += 1; console.error(`✗ ${msg}`); };

function walk(dir, predicate = () => true) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, predicate));
    else if (predicate(p)) out.push(p);
  }
  return out;
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function run(label, command, args) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  if (result.status !== 0) {
    fail(`${label} failed`);
    return false;
  }
  ok(label);
  return true;
}

function checkDuplicateIds() {
  const htmlFiles = walk(SRC, p => p.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = read(file);
    const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
    const seen = new Set();
    const dupes = new Set();
    for (const id of ids) {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    }
    if (dupes.size) fail(`${path.relative(ROOT,file)} duplicate IDs: ${[...dupes].join(', ')}`);
  }
  if (!failures) ok('No duplicate static HTML IDs detected');
}

function checkPrivateNoindex() {
  const privateCandidates = walk(path.join(SRC, 'subpages'), p => p.endsWith('.html'))
    .filter(p => !/(privacy|cookies|terms|contact)\.html$/i.test(p));

  for (const file of privateCandidates) {
    const html = read(file);
    const isWorkspace = /workspace-app|data-workspace-page|login|register/i.test(html);
    if (!isWorkspace) continue;
    if (!/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html) &&
        !/<meta[^>]+content=["'][^"']*noindex/i.test(html)) {
      warn(`Private/auth candidate lacks obvious noindex: ${path.relative(ROOT,file)}`);
    }
  }
  ok('Private-page noindex scan completed');
}

function checkPublicMeta() {
  const publicNames = [
    'index.html',
    'minigames.html',
    'bracket-generator.html'
  ];
  for (const name of publicNames) {
    const file = path.join(SRC, name);
    if (!fs.existsSync(file)) continue;
    const html = read(file);
    if (!/<title>[^<]+<\/title>/i.test(html)) fail(`${name}: missing title`);
    if (!/<meta[^>]+name=["']description["']/i.test(html)) fail(`${name}: missing meta description`);
    if (!/<link[^>]+rel=["']canonical["']/i.test(html)) warn(`${name}: no canonical found`);
    const h1Count = (html.match(/<h1\b/gi) || []).length;
    if (h1Count !== 1) warn(`${name}: expected 1 H1, found ${h1Count}`);
  }
  ok('Public metadata sanity scan completed');
}

function checkLocalRefs() {
  const htmlFiles = walk(SRC, p => p.endsWith('.html'));
  const missing = [];
  for (const file of htmlFiles) {
    const html = read(file);
    const refs = [...html.matchAll(/(?:^|\s)(?:src|href)\s*=\s*["']([^"']+)["']/gi)]
      .map(m => m[1])
      .filter(v =>
        v &&
        !/^(?:https?:|mailto:|tel:|#|data:|javascript:)/i.test(v) &&
        !v.includes('${')
      );

    for (let ref of refs) {
      ref = ref.split('?')[0].split('#')[0];
      if (!ref) continue;

      // Extensionless routes are app/public routes, not static file references.
      const ext = path.extname(ref);
      if (!ext && !ref.endsWith('/')) continue;

      let target;
      if (ref.startsWith('/')) target = path.join(SRC, ref.replace(/^\/+/, ''));
      else target = path.resolve(path.dirname(file), ref);

      // Root "/" maps to index and should not be treated as a file.
      if (ref === '/') continue;

      if (!fs.existsSync(target)) {
        missing.push(`${path.relative(ROOT,file)} -> ${ref}`);
      }
    }
  }

  if (missing.length) {
    for (const item of missing.slice(0, 40)) warn(`Unresolved local ref: ${item}`);
    if (missing.length > 40) warn(`${missing.length - 40} additional unresolved refs omitted`);
  } else {
    ok('Local HTML asset/file references resolve');
  }
}

function checkAssetManifest() {
  const candidates = [
    path.join(SRC, 'assets', 'game', 'manifest.json'),
    path.join(SRC, 'assets', 'game', 'manifest.js'),
    path.join(SRC, 'assets', 'game', 'manifest.mjs')
  ];
  const manifest = candidates.find(fs.existsSync);
  if (!manifest) {
    warn('No central game asset manifest found at src/assets/game/manifest.*');
    return;
  }

  if (manifest.endsWith('.json')) {
    try {
      const data = JSON.parse(read(manifest));
      const entries = Array.isArray(data) ? data : Object.values(data.entities || data);
      const missing = [];
      for (const entry of entries) {
        const image = entry?.image || entry?.path || entry?.src;
        if (!image || typeof image !== 'string') continue;
        if (/^https?:/i.test(image)) continue;
        const rel = image.replace(/^\/+/, '');
        const target = rel.startsWith('assets/')
          ? path.join(SRC, rel)
          : path.join(path.dirname(manifest), rel);
        if (!fs.existsSync(target)) missing.push(image);
      }
      if (missing.length) fail(`Asset manifest has ${missing.length} missing local paths`);
      else ok(`Asset manifest parsed (${entries.length} entries)`);
    } catch (err) {
      fail(`Asset manifest JSON invalid: ${err.message}`);
    }
  } else {
    ok(`Asset manifest exists: ${path.relative(ROOT,manifest)} (JS manifest not statically parsed)`);
  }
}

function checkNoActionsReintroduced() {
  const workflows = path.join(ROOT, '.github', 'workflows');
  if (!fs.existsSync(workflows)) {
    ok('No GitHub Actions workflow directory present');
    return;
  }
  const active = walk(workflows, p => /\.ya?ml$/i.test(p));
  if (active.length) {
    warn(`GitHub Actions workflow files present: ${active.map(p=>path.relative(ROOT,p)).join(', ')}`);
  } else {
    ok('No active GitHub Actions YAML files found');
  }
}

function checkFixtureCatalog() {
  const file = path.join(SRC, 'fixtures', 'redesign', 'scenarios.json');
  if (!fs.existsSync(file)) {
    fail('Redesign fixture catalog is missing from src/fixtures/redesign');
    return;
  }
  try {
    const data = JSON.parse(read(file));
    const scenarios = Array.isArray(data) ? data : data.scenarios;
    const ids = scenarios?.map(item => item?.id).filter(Boolean) || [];
    if (!ids.length) fail('Redesign fixture catalog has no scenario IDs');
    else if (new Set(ids).size !== ids.length) fail('Redesign fixture catalog has duplicate IDs');
    else ok(`Redesign fixture catalog parsed (${ids.length} scenarios)`);
  } catch (err) {
    fail(`Redesign fixture catalog invalid: ${err.message}`);
  }
}

function checkBuildOutputIfPresent() {
  if (!fs.existsSync(DIST)) {
    warn('dist/ not present; run npm run build before final verification');
    return;
  }
  const files = walk(DIST);
  if (!files.length) fail('dist/ exists but is empty');
  else ok(`dist/ contains ${files.length} files`);
}

console.log('ClashPanel redesign verifier');
console.log(`Mode: ${full ? 'FULL' : 'FAST'}\n`);

if (!fs.existsSync(SRC)) {
  fail('src/ directory not found. Run from repository root.');
} else {
  checkDuplicateIds();
  checkPrivateNoindex();
  checkPublicMeta();
  checkLocalRefs();
  checkAssetManifest();
  checkFixtureCatalog();
  checkNoActionsReintroduced();
  checkBuildOutputIfPresent();
}

if (full) {
  // Reuse existing local checks; this does not create CI or deploy.
  run('Filename casing', 'npm', ['run', 'check:casing']);
  run('Endpoint contracts', 'npm', ['run', 'check:endpoints']);
  run('Migration checks', 'npm', ['run', 'check:migrations']);
  run('Production build', 'npm', ['run', 'build']);
  run('Static output checks', 'npm', ['run', 'check:static']);
  run('SEO output checks', 'npm', ['run', 'check:seo']);

  if (process.argv.includes('--tests')) {
    run('Existing test suite', 'npm', ['test']);
  } else {
    console.log('\nℹ Existing test suite skipped. Add --tests if you explicitly want it.');
  }
}

console.log(`\nResult: ${failures} failure(s), ${warnings} warning(s).`);
if (failures) process.exit(1);
