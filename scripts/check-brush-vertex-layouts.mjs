import { parseArgs } from "node:util";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { createBrushGeometryArrays, generateBrushGeometryInto, getOpenBrushGeometryDefaults } from "three-tiltloader";
import { selectRequiredFixtures } from "./compare-unity-mesh-fixtures.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const { values } = parseArgs({ options: { fixtures: { type: "string" }, output: { type: "string" } } });
if (!values.fixtures || !values.output) throw new Error("Usage: node scripts/check-brush-vertex-layouts.mjs --fixtures <native fixture directory> --output <report.json>");
const inventory = await readFile("src/brushes/generated/brush-assets.json");
const required = new Set(Object.entries(JSON.parse(inventory).brushes).filter(([, b]) => b.catalogSection && !b.tags?.includes("broken") && (b.tags?.includes("default") || b.tags?.includes("experimental"))).map(([guid]) => guid.toLowerCase()));
const records = [];
for (const file of (await readdir(values.fixtures)).filter((name) => name.endsWith(".mesh.json"))) {
  const bytes = await readFile(path.join(values.fixtures, file));
  const fixture = JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
  records.push({ guid: fixture.brushGuid.toLowerCase(), file, sha256: hash(bytes), fixture });
}
const code = await build({ entryPoints: ["src/brushes/brush-vertex-layout.ts"], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
const { assertBrushGeometryArrays } = await import(`data:text/javascript;base64,${Buffer.from(code.outputFiles[0].text).toString("base64")}`);
const report = {
  schemaVersion: 1, recordedAt: new Date().toISOString(),
  scope: "generated buffer capacities/layouts across native-input control-point prefixes and finalization; not incremental native mesh or image equivalence",
  appRevision: spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim(),
  runnerSha256: hash(await readFile(new URL(import.meta.url))),
  contractSha256: hash(await readFile("src/brushes/brush-vertex-layout.ts")),
  inventorySha256: hash(inventory), lockfileSha256: hash(await readFile("package-lock.json")),
  brushes: [],
};
for (const record of selectRequiredFixtures(records, required)) {
  const row = { guid: record.guid, file: record.file, sha256: record.sha256, checks: 0, status: "pending", layouts: [] };
  report.brushes.push(row);
  try {
    if (record.fixture.schemaVersion !== 1 || record.fixture.strokes?.length !== 1) throw new Error("Expected one version-1 native stroke.");
    const input = record.fixture.strokes[0].input;
    if (input?.brushGuid?.toLowerCase() !== record.guid) throw new Error("Input brush GUID differs from fixture identity.");
    const defaults = getOpenBrushGeometryDefaults(record.guid);
    if (!defaults) throw new Error("No canonical generator defaults.");
    const points = input.controlPoints.map((point) => ({ ...point,
      position: [point.position[0] * 0.1, point.position[1] * 0.1, -point.position[2] * 0.1],
      orientation: [-point.orientation[0], -point.orientation[1], point.orientation[2], point.orientation[3]],
    }));
    const stroke = { ...input, brushSize: input.brushSize * 0.1, flags: Number(input.flags), guid: record.guid, groupId: 0, layerIndex: 0 };
    const arrays = createBrushGeometryArrays();
    const layouts = new Set();
    const check = (count, finalized) => {
      generateBrushGeometryInto({ ...stroke, controlPoints: points.slice(0, count) }, defaults.family,
        { ...defaults, deterministicBirthTime: true, finalized, lastControlPointIsKeeper: true }, arrays);
      assertBrushGeometryArrays(arrays, record.guid);
      layouts.add(`${arrays.uv0Size}/${arrays.uv1Size}`);
      row.checks++;
    };
    for (let count = 1; count <= points.length; count++) check(count, false);
    if (!points.length) throw new Error("Native input has no control points.");
    check(points.length, true);
    row.layouts = [...layouts]; row.finalVertexCount = arrays.vertexCount; row.finalIndexCount = arrays.indexCount;
    row.status = "layout-capacity-match";
  } catch (error) { row.status = "failed"; row.error = error.message; }
}
report.counts = { brushes: report.brushes.length, passed: report.brushes.filter((row) => row.status === "layout-capacity-match").length, checks: report.brushes.reduce((n, row) => n + row.checks, 0) };
await mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
await writeFile(values.output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Vertex layout capacity checks: ${report.counts.passed}/${required.size} brushes; ${report.counts.checks} generated states.`);
if (report.counts.passed !== required.size) process.exitCode = 1;
