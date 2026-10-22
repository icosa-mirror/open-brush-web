import { build } from "esbuild";
import { readFile, mkdir, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function archive(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return unzipSync(bytes.subarray(view.getUint16(4, true)));
}
const metadata = entries => JSON.parse(new TextDecoder().decode(entries["metadata.json"]));

async function main() {
  const { values } = parseArgs({ options: { sample: { type: "string" }, output: { type: "string" } } });
  if (!values.sample || !values.output) throw new Error("Usage: node scripts/audit-tilt-roundtrip.mjs --sample <native .tilt> --output <new directory>");
  const bytes = await readFile(values.sample);
  await mkdir(".tmp", { recursive: true });
  const temporary = await mkdtemp(path.resolve(".tmp/tilt-roundtrip-"));
  const bundle = path.join(temporary, "reader.mjs");
  try {
    await build({ entryPoints: ["src/sketch/tilt-file.ts"], outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external" });
    const { readTiltFile, writeTiltFile } = await import(pathToFileURL(bundle).href);
    const document = readTiltFile(bytes), rewritten = writeTiltFile(document), reparsed = readTiltFile(rewritten);
    if (!isDeepStrictEqual(document.strokes, reparsed.strokes)) throw new Error("Known stroke values changed on archive rewrite");
    if (!isDeepStrictEqual(document.layers, reparsed.layers) || !isDeepStrictEqual(document.media, reparsed.media)) throw new Error("App layer/media values changed on rewrite");
    const originalEntries = archive(bytes), newEntries = archive(rewritten);
    const originalMetadata = metadata(originalEntries), newMetadata = metadata(newEntries);
    const droppedMetadataKeys = Object.keys(originalMetadata).filter(key => !(key in newMetadata)).sort();
    const changedMetadataKeys = Object.keys(originalMetadata).filter(key => key in newMetadata && !isDeepStrictEqual(originalMetadata[key], newMetadata[key])).sort();
    const sourceFiles = ["src/sketch/sketch-memory.ts", "src/sketch/tilt-file.ts", "src/sketch/document.ts", "src/sketch/binary.ts", "node_modules/three-tiltloader/dist/three-tiltloader.module.js", "scripts/audit-tilt-roundtrip.mjs", "package-lock.json"];
    const report = { schemaVersion: 1, recordedAt: new Date().toISOString(),
      scope: "File-format sample audit; app-known values only, no live native Editor import or metadata-equivalence pass",
      sample: path.basename(values.sample), sampleSha256: hash(bytes),
      sourceHashes: Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(file))]))),
      strokeCount: document.strokes.length, controlPointCount: document.strokes.reduce((n, stroke) => n + stroke.controlPoints.length, 0),
      brushGuidCount: new Set(document.strokes.map(stroke => stroke.brushGuid)).size,
      knownStrokeValuesSurviveRewrite: true, appLayerAndMediaValuesSurviveRewrite: true,
      originalMetadataKeys: Object.keys(originalMetadata).sort(), droppedMetadataKeys, changedMetadataKeys,
      originalEntries: Object.keys(originalEntries).sort(), droppedEntries: Object.keys(originalEntries).filter(key => !(key in newEntries)).sort(),
      thumbnailBytesPreserved: originalEntries["thumbnail.png"] && newEntries["thumbnail.png"] ? hash(originalEntries["thumbnail.png"]) === hash(newEntries["thumbnail.png"]) : null,
      nativeMetadataEquivalence: "unverified", liveNativeImport: "unverified" };
    await mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
    await mkdir(values.output);
    await writeFile(path.join(values.output, "results.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ strokes: report.strokeCount, controlPoints: report.controlPointCount, knownStrokeValuesSurviveRewrite: true, droppedMetadataKeys, thumbnailBytesPreserved: report.thumbnailBytesPreserved }));
  } finally {
    await unlink(bundle).catch(error => { if (error.code !== "ENOENT") throw error; });
    await rmdir(temporary);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
