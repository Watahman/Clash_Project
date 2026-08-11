#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const version = arg("--version", "0.16.0");
const destination = path.resolve(arg("--dest", "src/assets"));
const packageName = "clash-of-clans-data";

function ensure(p) { fs.mkdirSync(p, { recursive: true }); }
function kebab(s) {
  return String(s || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { console.warn(`WARN invalid JSON: ${file}: ${e.message}`); return null; }
}
function detectExt(file) {
  const b = fs.readFileSync(file);
  if (b.length >= 12 && b.toString("ascii",0,4)==="RIFF" && b.toString("ascii",8,12)==="WEBP") return ".webp";
  if (b.length >= 8 && b[0]===0x89 && b.toString("ascii",1,4)==="PNG") return ".png";
  if (b.length >= 3 && b[0]===0xff && b[1]===0xd8 && b[2]===0xff) return ".jpg";
  const ext = path.extname(file).toLowerCase();
  return ext || ".bin";
}
function copyImage(packageRoot, rel, outDir, outBase) {
  if (!rel) return null;
  const src = path.join(packageRoot, rel.replaceAll("/", path.sep));
  if (!fs.existsSync(src)) {
    console.warn(`MISS source image: ${rel}`);
    return null;
  }
  ensure(outDir);
  const ext = detectExt(src);
  const dst = path.join(outDir, `${kebab(outBase)}${ext}`);
  fs.copyFileSync(src, dst);
  return dst;
}
function latestNormal(levels) {
  if (!Array.isArray(levels)) return null;
  for (let i = levels.length - 1; i >= 0; --i) {
    const imgs = levels[i]?.images;
    if (imgs?.normal) return imgs.normal;
    if (imgs?.icon) return imgs.icon;
    if (imgs && typeof imgs === "object") {
      const v = Object.values(imgs).find(x => typeof x === "string");
      if (v) return v;
    }
  }
  return null;
}
function topIcon(obj) {
  return obj?.images?.icon || obj?.images?.normal || latestNormal(obj?.levels);
}
function walk(dir, pred = () => true) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p, pred));
    else if (pred(p)) out.push(p);
  }
  return out;
}

const packageRootArg = arg("--package-root", null);

if (!packageRootArg) {
  console.error("Missing required --package-root argument.");
  console.error("Run this script through collect-assets.ps1 or provide an extracted clash-of-clans-data package directory.");
  process.exit(2);
}

const pkg = path.resolve(packageRootArg);

if (!fs.existsSync(pkg)) {
  console.error(`Package directory does not exist: ${pkg}`);
  process.exit(2);
}

const packageJson = readJson(path.join(pkg, "package.json"));
const detectedVersion = packageJson?.version || version;
console.log(`Reading Clash assets from ${pkg}`);
console.log(`Detected source version: ${detectedVersion}`);

const gameRoot = path.join(destination, "game");
const categoryDirs = {
  "troops": "troops",
  "spells": "spells",
  "siege-machines": "siege-machines",
  "heroes": "heroes",
  "hero-equipment": "equipment",
  "pets": "pets",
  "defenses": "defenses",
  "traps": "traps",
  "resource-buildings": "buildings",
  "army-buildings": "buildings",
};
const entityCategory = {
  buildings: "building",
  defenses: "defense",
  equipment: "equipment",
  heroes: "hero",
  pets: "pet",
  "siege-machines": "siege-machine",
  spells: "spell",
  traps: "trap",
  troops: "troop"
};
for (const d of Object.values(categoryDirs)) ensure(path.join(gameRoot, d));
ensure(path.join(gameRoot, "super-troops"));
ensure(path.join(gameRoot, "town-halls"));

const entities = {};
const counts = {};
function addEntity(id, name, category, file, aliases = [], sourcePath = null) {
  if (!file) return;
  const rel = "/assets/" + path.relative(destination, file).replaceAll(path.sep, "/");
  entities[id] = { id, name, category, image: rel, aliases, sourcePath };
  counts[category] = (counts[category] || 0) + 1;
}

const dataHome = path.join(pkg, "data", "home");
for (const [srcFolder, destCategory] of Object.entries(categoryDirs)) {
  const folder = path.join(dataHome, srcFolder);
  for (const jsonFile of walk(folder, p => p.endsWith(".json"))) {
    const obj = readJson(jsonFile);
    if (!obj?.id) continue;
    const relImage = topIcon(obj);
    const output = copyImage(pkg, relImage, path.join(gameRoot, destCategory), obj.id);
    addEntity(kebab(obj.id), obj.name || obj.id, entityCategory[destCategory], output, [], relImage);

    if (srcFolder === "troops" && obj.superTroop?.id) {
      const st = obj.superTroop;
      const stRel = topIcon(st);
      const stOut = copyImage(pkg, stRel, path.join(gameRoot, "super-troops"), st.id);
      addEntity(kebab(st.id), st.name || st.id, "super-troop", stOut, [], stRel);
    }
  }
}

// Town Hall: one image per level
const thFiles = walk(path.join(dataHome, "town-hall"), p => p.endsWith(".json"));
for (const f of thFiles) {
  const obj = readJson(f);
  if (!obj) continue;
  for (const level of obj.levels || []) {
    const n = level.level ?? level.townHallLevel ?? level.townHall;
    if (!n) continue;
    const rel = level?.images?.normal || level?.images?.icon || Object.values(level?.images || {}).find(v => typeof v === "string");
    const out = copyImage(pkg, rel, path.join(gameRoot, "town-halls"), `town-hall-${n}`);
    addEntity(`town-hall-${n}`, `Town Hall ${n}`, "town-hall", out, [`TH${n}`], rel);
  }
}

// If the package stores a single town-hall JSON outside that exact folder, find it too.
if (!Object.keys(entities).some(k => k.startsWith("town-hall-"))) {
  for (const f of walk(dataHome, p => p.endsWith(".json") && /town.?hall/i.test(p))) {
    const obj = readJson(f);
    for (const level of obj?.levels || []) {
      const n = level.level ?? level.townHallLevel ?? level.townHall;
      if (!n) continue;
      const rel = level?.images?.normal || level?.images?.icon || Object.values(level?.images || {}).find(v => typeof v === "string");
      const out = copyImage(pkg, rel, path.join(gameRoot, "town-halls"), `town-hall-${n}`);
      addEntity(`town-hall-${n}`, `Town Hall ${n}`, "town-hall", out, [`TH${n}`], rel);
    }
  }
}

// Best-effort copy of league imagery
const imageRoot = path.join(pkg, "images");
const leagueFiles = walk(imageRoot, p => /league/i.test(p) && /\.(png|webp|jpg|jpeg)$/i.test(p));
for (const src of leagueFiles) {
  const rel = path.relative(imageRoot, src).replaceAll(path.sep, "/");
  let bucket = "multiplayer";
  if (/builder/i.test(rel)) bucket = "builder";
  else if (/capital/i.test(rel)) bucket = "capital";
  else if (/cwl|war.?league/i.test(rel)) bucket = "cwl";
  const ext = detectExt(src);
  const base = kebab(path.basename(src, path.extname(src)));
  const parent = kebab(path.basename(path.dirname(src)));
  const outDir = path.join(gameRoot, "leagues", bucket);
  ensure(outDir);
  let dst = path.join(outDir, `${parent && parent !== bucket ? parent + "-" : ""}${base}${ext}`);
  let i = 2;
  while (fs.existsSync(dst)) dst = path.join(outDir, `${parent}-${base}-${i++}${ext}`);
  fs.copyFileSync(src, dst);
}

// Copy upstream license
const sourceDir = path.join(destination, "sources");
ensure(sourceDir);
const upstreamLicense = path.join(pkg, "LICENSE");
if (fs.existsSync(upstreamLicense)) {
  fs.copyFileSync(upstreamLicense, path.join(sourceDir, "THIRD_PARTY_LICENSE_clash-of-clans-data.txt"));
}

const manifest = {
  _meta: {
    generatedAt: new Date().toISOString(),
    sourcePackage: packageName,
    sourceVersion: detectedVersion,
    entityCount: Object.keys(entities).length,
    notes: [
      "Underlying Clash of Clans imagery is Supercell intellectual property.",
      "Use assets in accordance with the Supercell Fan Content Policy.",
      "Dynamic clan badges are intentionally not copied."
    ]
  },
  entities: Object.fromEntries(Object.entries(entities).sort(([a],[b]) => a.localeCompare(b)))
};
ensure(gameRoot);
fs.writeFileSync(path.join(gameRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

const report = [
  "# Clash asset collection report",
  "",
  `- Package: \`${packageName}@${detectedVersion}\``,
  `- Generated: ${manifest._meta.generatedAt}`,
  `- Entity images collected: **${manifest._meta.entityCount}**`,
  "",
  "## By category",
  "",
  ...Object.entries(counts).sort().map(([k,v]) => `- ${k}: ${v}`),
  "",
  "## Notes",
  "",
  "- League imagery is copied on a best-effort basis from package paths containing `league`.",
  "- Clan badges remain dynamic.",
  "- Product screenshots/social cards are intentionally post-redesign assets.",
  "- Missing entities fall back to `placeholders/unavailable-entity.svg` in the application.",
  ""
].join("\n");
fs.writeFileSync(path.join(sourceDir, "COLLECTION_REPORT.md"), report, "utf8");

console.log("");
console.log("ClashPanel asset collection complete.");
console.log(`Entity images: ${manifest._meta.entityCount}`);
for (const [k,v] of Object.entries(counts).sort()) console.log(`  ${k}: ${v}`);
console.log(`Manifest: ${path.join(gameRoot, "manifest.json")}`);
