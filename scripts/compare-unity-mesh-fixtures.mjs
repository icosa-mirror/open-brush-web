import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** A newer native catalog may contain extras, but required GUIDs cannot be missing or duplicated. */
export function selectRequiredFixtures(records, requiredGuids) {
  if (requiredGuids.size === 0) throw new Error("Required brush inventory is empty.");
  const selected = new Map();
  for (const record of records) {
    const guid = record.guid.toLowerCase();
    if (!requiredGuids.has(guid)) continue;
    if (selected.has(guid)) throw new Error(`Duplicate required fixture GUID ${guid}.`);
    selected.set(guid, record);
  }
  const missing = [...requiredGuids].filter((guid) => !selected.has(guid));
  if (missing.length) throw new Error(`Missing ${missing.length} required fixture(s): ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""}`);
  return [...selected.values()].sort((a, b) => a.guid.localeCompare(b.guid));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--fixtures" || args[2] !== "--output") {
    throw new Error("Usage: node scripts/compare-unity-mesh-fixtures.mjs --fixtures <Unity Support/BrushFixtures> --output <report.json>");
  }
  const directory = path.resolve(args[1]);
  const output = path.resolve(args[3]);
  const assets = JSON.parse(await readFile(path.join(repoRoot, "src/brushes/generated/brush-assets.json"), "utf8"));
  const required = new Set(Object.entries(assets.brushes)
    .filter(([, brush]) => brush.catalogSection && !brush.tags?.includes("broken") &&
      (brush.tags?.includes("default") || brush.tags?.includes("experimental")))
    .map(([guid]) => guid.toLowerCase()));
  const records = [];
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".mesh.json")).sort()) {
    const bytes = await readFile(path.join(directory, file));
    const fixture = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
    if (typeof fixture.brushGuid !== "string") throw new Error(`Missing brush GUID in ${file}.`);
    records.push({ file, guid: fixture.brushGuid.toLowerCase(), sha256: sha256(bytes), bytes });
  }
  const selected = selectRequiredFixtures(records, required);
  const tempRoot = path.resolve(repoRoot, ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const work = await mkdtemp(path.join(tempRoot, "unity-mesh-"));
  try {
    const inputs = path.join(work, "inputs");
    await mkdir(inputs);
    for (const record of selected) await writeFile(path.join(inputs, record.file), record.bytes);
    const bundle = path.join(work, "compare.mjs");
    // Node 24 refuses to strip types inside node_modules. Bundle the installed,
    // pinned comparator without modifying its source or dependency references.
    const comparator = path.join(repoRoot, "node_modules/three-tiltloader/scripts/compare-open-brush-fixtures.mjs");
    await build({ entryPoints: [comparator], outfile: bundle, bundle: true,
      platform: "node", format: "esm", packages: "external", logLevel: "silent" });
    const reportPath = path.join(work, "report.json");
    const result = spawnSync(process.execPath, [bundle, "--fixtures", inputs,
      "--format", "json", "--output", reportPath], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    if (result.error) throw result.error;
    let report;
    try { report = JSON.parse(await readFile(reportPath, "utf8")); }
    catch { throw new Error(`Comparator did not produce a report: ${(result.stderr || result.stdout || "").slice(-1000)}`); }
    const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
    const revision = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
    report.evidence = {
      recordedAt: new Date().toISOString(), scope: "finalized-live-mesh",
      appRevision: revision.status === 0 ? revision.stdout.trim() : null,
      nodeVersion: process.version, fixtureDirectory: directory,
      requiredCount: required.size, excludedNativeGuids: records.filter((record) => !required.has(record.guid)).map(({ guid, file }) => ({ guid, file })),
      packages: Object.fromEntries(["three-tiltloader", "three-icosa"].map((name) => [name, pkg.dependencies[name]])),
      comparatorSha256: sha256(await readFile(comparator)),
      runnerSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
      inventorySha256: sha256(await readFile(path.join(repoRoot, "src/brushes/generated/brush-assets.json"))),
      packageLockSha256: sha256(await readFile(path.join(repoRoot, "package-lock.json"))),
      inputs: selected.map(({ guid, file, sha256 }) => ({ guid, file, sha256 })),
    };
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Required live meshes: ${report.counts.match}/${required.size} match; ${records.length - selected.length} extra native fixtures excluded. Report: ${output}`);
    if (result.status !== 0 || report.counts.total !== required.size || report.counts.match !== required.size) process.exitCode = 1;
  } finally {
    const relative = path.relative(tempRoot, work);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Unsafe temporary directory cleanup path.");
    await rm(work, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
