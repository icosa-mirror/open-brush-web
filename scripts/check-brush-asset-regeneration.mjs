#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scopes = ["public/openbrush/shaders", "public/openbrush/textures", "public/openbrush/icons",
  "public/openbrush/NOTICE", "src/brushes/generated/exportManifest.json", "src/brushes/generated/brush-assets.json"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

function inventory(root, selected) {
  const files = new Map();
  function visit(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error(`Unexpected generated-asset symlink: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute).sort()) visit(`${relative}/${name}`);
    } else if (stat.isFile()) files.set(relative, hash(fs.readFileSync(absolute)));
  }
  for (const relative of selected) visit(relative);
  return files;
}

export function compareAssetTrees(expectedRoot, generatedRoot, selected = scopes) {
  const expected = inventory(expectedRoot, selected), generated = inventory(generatedRoot, selected);
  const files = [...new Set([...expected.keys(), ...generated.keys()])].sort().map(file => ({
    file, expectedSha256: expected.get(file) ?? null, generatedSha256: generated.get(file) ?? null,
    status: !generated.has(file) ? "missing-generated" : !expected.has(file) ? "missing-checked-in" :
      expected.get(file) !== generated.get(file) ? "different" : "match",
  }));
  return { expectedCount: expected.size, generatedCount: generated.size, files,
    differences: files.filter(file => file.status !== "match") };
}

function main() {
  const { values } = parseArgs({ options: { output: { type: "string" } } });
  const output = path.resolve(values.output ?? path.join(repoRoot, ".tmp/brush-asset-regeneration.json"));
  const pin = JSON.parse(fs.readFileSync(path.join(repoRoot, "open-brush-reference.json"), "utf8"));
  const reference = path.join(repoRoot, "reference");
  if (!fs.existsSync(path.join(reference, "Assets"))) throw new Error("Missing pinned reference checkout: populate reference/ at the commit in open-brush-reference.json.");
  const git = args => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const actual = git(["-C", reference, "rev-parse", "HEAD"]);
  if (actual !== pin.commit) throw new Error(`Reference revision ${actual} differs from pinned ${pin.commit}.`);
  if (git(["-C", reference, "status", "--porcelain", "--untracked-files=no"])) throw new Error("Reference has tracked modifications; use a clean pinned reference for regeneration.");
  fs.mkdirSync(path.join(repoRoot, ".tmp"), { recursive: true });
  const temporaryRoot = fs.mkdtempSync(path.join(repoRoot, ".tmp/brush-regeneration-"));
  const logPath = path.join(temporaryRoot, "extraction.log");
  const descriptor = fs.openSync(logPath, "w");
  let extraction;
  try {
    extraction = spawnSync(process.execPath, [path.join(repoRoot, "scripts/extract-brush-assets.mjs"), "--output-root", temporaryRoot],
      { cwd: repoRoot, stdio: ["ignore", descriptor, descriptor] });
  } finally { fs.closeSync(descriptor); }
  if (extraction.error || extraction.status !== 0) throw new Error(`Extraction failed; inspect ${logPath}`);
  const result = compareAssetTrees(repoRoot, temporaryRoot);
  const report = { recordedAt: new Date().toISOString(), applicationRevision: git(["rev-parse", "HEAD"]),
    reference: { repository: pin.repository, commit: actual }, temporaryRoot, logPath,
    sourceHashes: Object.fromEntries(["scripts/extract-brush-assets.mjs", "scripts/check-brush-asset-regeneration.mjs", "package-lock.json"].map(file => [file, hash(fs.readFileSync(path.join(repoRoot, file)))])),
    ...result };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(`Brush regeneration: ${result.generatedCount} generated, ${result.expectedCount} checked in, ${result.differences.length} differences. Report: ${output}`);
  if (!result.expectedCount || !result.generatedCount) throw new Error("Empty brush asset inventory.");
  if (result.differences.length) {
    for (const row of result.differences.slice(0, 5)) console.error(`${row.status}: ${row.file}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
