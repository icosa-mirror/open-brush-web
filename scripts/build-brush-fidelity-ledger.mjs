import { parseArgs } from "node:util";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { joinBrushFidelityEvidence, requireMatchingHash } from "./brush-fidelity-evidence.mjs";

const { values } = parseArgs({ options: { output: { type: "string" } } });
if (!values.output) throw new Error("Usage: node scripts/build-brush-fidelity-ledger.mjs --output <directory>");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const base = "docs/evidence/brush-fidelity";
const paths = {
  generation: "native-2026-10-21/manifest.json", mesh: "native-2026-10-21/live-mesh-comparison.json",
  exports: "export-accessors-2026-10-21/results.json", postLoader: "post-loader-2026-10-21/results.json",
  captures: "browser-images-packed-uv-2026-10-21/results.json", layout: "vertex-layout-2026-10-22/results.json",
  images: "native-2026-10-21/image-corpus-inventory.json",
  compileCaptures: "browser-shader-compile-2026-10-22/results.json",
  attributeProbeCaptures: "attribute-default-probe-2026-10-22/results.json",
  attributeProbeControls: "attribute-default-probe-2026-10-22/gpu-controls.json",
  emulatedXr: "emulated-xr-shader-compile-2026-10-22/results.json",
};
const data = {}, sources = {};
for (const [key, relative] of Object.entries(paths)) {
  const file = `${base}/${relative}`, bytes = await readFile(file), report = JSON.parse(bytes);
  data[key] = report;
  sources[key] = { file, sha256: hash(bytes), appRevision: report.appRevision ?? report.evidence?.appRevision ?? null,
    appRevisionMeaning: "recorded revision; see source evidence for producing changes and source hashes",
    nativeRevision: report.nativeRevision ?? null, scope: report.scope ?? report.comparison ?? report.kind ?? null };
}
const inventoryBytes = await readFile("src/brushes/generated/brush-assets.json");
const lockBytes = await readFile("package-lock.json");
const inventory = JSON.parse(inventoryBytes), manifest = JSON.parse(await readFile("src/brushes/generated/exportManifest.json"));
const packageJson = JSON.parse(await readFile("package.json"));
const assetSource = await readFile("src/brushes/brush-asset-base-url.ts");
const assetRevision = assetSource.toString().match(/ICOSA_SKETCH_ASSETS_REVISION\s*=\s*"([0-9a-f]{40})"/)?.[1];
if (!assetRevision) throw new Error("Configured default asset revision is missing.");
if (!data.captures.completedAt || !data.postLoader.completedAt || !data.compileCaptures.completedAt || !data.attributeProbeCaptures.completedAt) throw new Error("Incomplete browser run cannot be published as finished evidence.");
const required = Object.entries(inventory.brushes).filter(([, brush]) => brush.catalogSection && !brush.tags?.includes("broken") && (brush.tags?.includes("default") || brush.tags?.includes("experimental"))).map(([guid, brush]) => ({ guid: guid.toLowerCase(), name: manifest.brushes[guid].name, catalogSection: brush.catalogSection }));
if (!required.length) throw new Error("Required inventory is empty.");
for (const key of ["mesh", "exports", "captures", "layout", "compileCaptures", "attributeProbeCaptures", "emulatedXr"]) {
  const report = data[key].evidence ?? data[key];
  requireMatchingHash(report.inventorySha256, hash(inventoryBytes), `${key} inventory`);
  requireMatchingHash(report.packageLockSha256 ?? report.lockfileSha256, hash(lockBytes), `${key} lockfile`);
}
requireMatchingHash(data.postLoader.lockfileSha256, hash(lockBytes), "post-loader lockfile");
requireMatchingHash(data.exports.nativeGenerationManifestSha256, sources.generation.sha256, "export generation manifest");
requireMatchingHash(data.emulatedXr.nativeGenerationManifestSha256, sources.generation.sha256, "XR generation manifest");
const reference = JSON.parse(await readFile("open-brush-reference.json"));
const rows = joinBrushFidelityEvidence(required, data);
const ledger = {
  schemaVersion: 1, recordedAt: new Date().toISOString(),
  scope: "Joined recorded per-GUID evidence under each source revision; no aggregate parity score or new capture/compile/device result",
  producerAppRevision: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(),
  runnerSha256: hash(await readFile(new URL(import.meta.url))),
  joinerSha256: hash(await readFile(new URL("./brush-fidelity-evidence.mjs", import.meta.url))),
  inventorySha256: hash(inventoryBytes), lockfileSha256: hash(lockBytes),
  packagePins: Object.fromEntries(["three-tiltloader", "three-icosa"].map((name) => [name, packageJson.dependencies[name]])),
  configuredDefaultAssetRevision: assetRevision, assetConfigurationSha256: hash(assetSource),
  assetAttribution: "current default configuration; historical per-request asset content audits remain unverified",
  declaredNativeReference: reference.commit, generatedNativeReference: data.generation.nativeRevision,
  referenceRevisionAlignment: reference.commit === data.generation.nativeRevision ? "same-revision" : "different-revisions; reconciliation unverified",
  sources, requiredCount: rows.length,
  evidenceDefinitions: { actualXrShaderCompile: "Physical-device XR compilation remains unverified; active IWER session results are recorded separately as emulatedXrShaderCompile." },
  counts: {
    liveMeshRecordedMatches: rows.filter((r) => r.liveMesh.status === "match").length,
    exportAccessorRecordedMatches: rows.filter((r) => r.exportAccessors.status === "exporter-transform-match").length,
    fixtureShaderPaths: rows.filter((r) => r.fixturePostLoader.shaderMeshes > 0).length,
    fixturePbrPaths: rows.filter((r) => r.fixturePostLoader.pbrMeshes > 0).length,
    normalExportObservedByName: rows.filter((r) => r.normalExportPostLoader.status === "observed-by-material-name").length,
    browserCaptures: rows.filter((r) => r.browserCapture.status === "captured").length,
    coverageSmokePasses: rows.filter((r) => r.browserCapture.coverageSmoke === "pass").length,
    layoutCapacityMatches: rows.filter((r) => r.bufferLayout.status === "layout-capacity-match").length,
    browserCompileRecordedLinks: rows.filter((r) => r.browserShaderCompileAudit === "recorded-linked").length,
    attributeDefaultRgbInvariantBrushes: rows.filter((r) => r.unboundAttributeDefaultProbe?.status === "recorded-rgb-invariant").length,
    emulatedXrCompileRecordedLinks: rows.filter((r) => r.emulatedXrShaderCompile === "recorded-emulated-session-link").length,
    visualParityVerified: 0, actualXrCompileVerified: 0, devicePerformanceVerified: 0,
  }, brushes: rows,
};
const table = ["# Required brush evidence index", "", "Recorded evidence only. Physical-device XR compilation, visual parity and device performance remain unverified. Active IWER session links are a separate emulator observation. JSON entries retain source hashes and revisions. `coverage fail` is a rendering smoke failure, not a Unity visual-parity verdict.", "", "| Brush | GUID | Live mesh | Export accessors | Fixture loader | Normal export | Browser capture | Browser link | Emulated XR | UV0 | Buffer layout |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
const safe = (value) => String(value).replaceAll("|", "\\|");
for (const row of rows) table.push(`| ${safe(row.name)} | ${row.guid} | ${row.liveMesh.status} | ${row.exportAccessors.status} | ${row.fixturePostLoader.shaderMeshes ? "shader" : "PBR"} | ${row.normalExportPostLoader.meshes.length ? "observed by name" : "unverified"} | ${row.browserCapture.status}; coverage ${row.browserCapture.coverageSmoke} | ${row.browserShaderCompileAudit} | ${row.emulatedXrShaderCompile === "recorded-emulated-session-link" ? "session link" : "unverified"} | ${row.browserCapture.generatedUv0Size}/${row.browserCapture.shaderUv0Size} | ${row.bufferLayout.status} |`);
await mkdir(values.output, { recursive: true });
await writeFile(path.join(values.output, "ledger.json"), `${JSON.stringify(ledger, null, 2)}\n`);
await writeFile(path.join(values.output, "brushes.md"), `${table.join("\n")}\n`);
console.log(`Joined ${rows.length} required GUIDs; ${ledger.counts.liveMeshRecordedMatches} recorded mesh matches, ${ledger.counts.coverageSmokePasses} coverage passes. Visual parity remains unverified.`);
