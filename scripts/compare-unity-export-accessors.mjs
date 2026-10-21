import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { selectRequiredFixtures } from "./compare-unity-mesh-fixtures.mjs";
import { readFixtureGlb, comparePostBakerExport } from "./unity-glb-export-contract.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const { values } = parseArgs({ options: {
    fixtures: { type: "string" }, output: { type: "string" },
    "color-space": { type: "string" }, manifest: { type: "string" },
  } });
  if (!values.fixtures || !values.output || !["Gamma", "Linear"].includes(values["color-space"])) throw new Error("Usage: node scripts/compare-unity-export-accessors.mjs --fixtures <directory> --output <report.json> --color-space <Gamma|Linear> [--manifest <native generation manifest>]");
  const directory = path.resolve(values.fixtures);
  const inventoryBytes = await readFile(path.join(root, "src/brushes/generated/brush-assets.json"));
  const assets = JSON.parse(inventoryBytes);
  const required = new Set(Object.entries(assets.brushes).filter(([, brush]) => brush.catalogSection && !brush.tags?.includes("broken") && (brush.tags?.includes("default") || brush.tags?.includes("experimental"))).map(([guid]) => guid.toLowerCase()));
  const records = [];
  for (const file of (await readdir(directory)).filter((name) => name.endsWith(".mesh.json")).sort()) {
    const bytes = await readFile(path.join(directory, file));
    const fixture = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
    if (typeof fixture.brushGuid !== "string") throw new Error(`Missing fixture GUID in ${file}.`);
    records.push({ file, fixture, guid: fixture.brushGuid.toLowerCase(), sha256: sha256(bytes) });
  }
  const selected = selectRequiredFixtures(records, required);
  const manifestBytes = values.manifest ? await readFile(path.resolve(values.manifest)) : null;
  const generation = manifestBytes ? JSON.parse(manifestBytes) : null;
  const recordedArtifacts = new Map(generation?.artifacts?.map((artifact) => [artifact.brushGuid.toLowerCase(), artifact]));
  const report = {
    schemaVersion: 1, recordedAt: new Date().toISOString(),
    scope: "post-BrushBaker mesh versus isolated UnityGLTF fixture accessor conversions",
    nativeColorSpaceModel: values["color-space"], tolerance: 1e-5,
    nativeRevision: generation?.nativeRevision ?? null,
    nativeGenerationManifestSha256: manifestBytes ? sha256(manifestBytes) : null,
    appRevision: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(),
    runnerSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    contractSha256: sha256(await readFile(new URL("./unity-glb-export-contract.mjs", import.meta.url))),
    inventorySha256: sha256(inventoryBytes),
    fixtureSelectionSha256: sha256(await readFile(new URL("./compare-unity-mesh-fixtures.mjs", import.meta.url))),
    lockfileSha256: sha256(await readFile(path.join(root, "package-lock.json"))),
    requiredCount: required.size, excludedNativeGuids: records.filter((record) => !required.has(record.guid)).map(({ guid, file }) => ({ guid, file })),
    productionSceneExport: "unverified; isolated fixture generator deliberately bypasses normal scene setup",
    postThreeIcosa: "unverified", visualParity: "unverified", brushes: [],
  };
  for (const record of selected) {
    const row = { guid: record.guid, name: record.fixture.durableName, meshFile: record.file, meshSha256: record.sha256 };
    try {
      const exported = record.fixture.strokes?.[0]?.exportedGlb;
      if (!exported?.file || path.basename(exported.file) !== exported.file || exported.skipped) throw new Error("Missing standalone native GLB fixture.");
      const bytes = await readFile(path.join(directory, exported.file));
      row.glbFile = exported.file; row.glbSha256 = sha256(bytes);
      if (bytes.byteLength !== exported.byteLength) throw new Error("GLB byte length differs from native fixture metadata.");
      if (generation) {
        const original = recordedArtifacts.get(record.guid);
        if (!original || original.mesh.sha256 !== record.sha256 || original.glb.sha256 !== row.glbSha256) throw new Error("Inputs differ from the recorded native generation manifest.");
      }
      Object.assign(row, comparePostBakerExport(record.fixture, readFixtureGlb(bytes), { colorSpace: values["color-space"] }));
      row.status = row.exporterTransformMatch ? "exporter-transform-match" : "exporter-transform-mismatch";
    } catch (error) { row.status = "comparison-error"; row.error = error.message; }
    report.brushes.push(row);
  }
  report.counts = {
    total: report.brushes.length,
    exporterTransformMatches: report.brushes.filter((row) => row.exporterTransformMatch).length,
    mismatches: report.brushes.filter((row) => row.status === "exporter-transform-mismatch").length,
    errors: report.brushes.filter((row) => row.status === "comparison-error").length,
    brushesWithDroppedComponents: report.brushes.filter((row) => row.droppedComponents?.length).length,
    bakerMappingsCovered: report.brushes.filter((row) => row.bakerMappingFound).length,
    nativeFixtureMarkers: report.brushes.filter((row) => row.fixtureMarker).length,
  };
  const output = path.resolve(values.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Required exporter transforms: ${report.counts.exporterTransformMatches}/${required.size} match; ${report.counts.brushesWithDroppedComponents} brushes have dropped UV components. Not a production/visual parity pass. Report: ${output}`);
  if (report.counts.exporterTransformMatches !== required.size) process.exitCode = 1;
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
