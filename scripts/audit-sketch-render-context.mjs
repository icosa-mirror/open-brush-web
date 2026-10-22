import { build } from "esbuild";
import { readFile, mkdir, mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import path from "node:path";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const { values } = parseArgs({ options: { sample: { type: "string" }, output: { type: "string" } } });
if (!values.sample || !values.output) throw new Error("Usage: node scripts/audit-sketch-render-context.mjs --sample <native .tilt> --output <report.json>");
await mkdir(".tmp", { recursive: true });
const temporary = await mkdtemp(path.resolve(".tmp/render-context-model-")), bundle = path.join(temporary, "model.mjs");
try {
  await build({ stdin: { contents: 'export { readTiltFile } from "./src/sketch/tilt-file.ts"; export { readNativeSketchRenderContext } from "./src/sketch/render-context.ts";', resolveDir: process.cwd() }, outfile: bundle, bundle: true, platform: "node", format: "esm", packages: "external", logLevel: "silent" });
  const { readTiltFile, readNativeSketchRenderContext } = await import(pathToFileURL(bundle).href);
  const bytes = await readFile(values.sample), document = readTiltFile(bytes);
  const original = JSON.stringify(document.tiltArchive?.metadata), context = readNativeSketchRenderContext(document.tiltArchive?.metadata);
  if (JSON.stringify(document.tiltArchive?.metadata) !== original) throw new Error("Context interpretation mutated native metadata.");
  const files = ["src/sketch/render-context.ts", "src/sketch/tilt-file.ts", "src/systems/sketch-library-system.ts", "scripts/audit-sketch-render-context.mjs", "package-lock.json"];
  const report = { recordedAt: new Date().toISOString(), scope: "Real file adapter and custom light/fog interpretation; no native Editor rendering or preset/skybox parity", sample: path.basename(values.sample), sampleSha256: hash(bytes), nativeMetadataSha256: hash(original ?? ""), context, metadataUnchanged: true,
    sourceHashes: Object.fromEntries(await Promise.all(files.map(async file => [file, hash(await readFile(file))]))) };
  await mkdir(path.dirname(path.resolve(values.output)), { recursive: true }); await writeFile(values.output, JSON.stringify(report, null, 2) + "\n");
  console.log(`Sketch context: fog=${context.fog?.density ?? "default"}, custom lights=${Number(!!context.shadow) + Number(!!context.noShadow)}, issues=${context.issues.length}. Report: ${values.output}`);
} finally { await unlink(bundle).catch(() => {}); await rmdir(temporary).catch(() => {}); }
