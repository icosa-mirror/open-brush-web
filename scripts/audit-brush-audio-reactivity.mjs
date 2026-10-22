#!/usr/bin/env node
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
import { build } from "esbuild";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const { values } = parseArgs({ options: { output: { type: "string" } } });
const output = values.output ?? ".tmp/brush-audio-reactivity.json";
const pin = JSON.parse(await readFile("open-brush-reference.json", "utf8"));
const revision = execFileSync("git", ["-C", "reference", "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (revision !== pin.commit) throw new Error("Audio audit requires the declared native reference revision.");
if (execFileSync("git", ["-C", "reference", "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim()) throw new Error("Audio audit requires a clean pinned native reference.");
const assetResolverBytes = await readFile("src/brushes/brush-asset-base-url.ts");
const assetPin = assetResolverBytes.toString().match(/ICOSA_SKETCH_ASSETS_REVISION\s*=\s*"([0-9a-f]{40})"/)?.[1];
const assetRevision = execFileSync("git", ["-C", "vendor/icosa-sketch-assets", "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const gitlink = execFileSync("git", ["rev-parse", "HEAD:vendor/icosa-sketch-assets"], { encoding: "utf8" }).trim();
if (!assetPin || assetRevision !== assetPin || gitlink !== assetPin) throw new Error("Runtime asset URL, submodule and application gitlink must agree for the audio audit.");
if (execFileSync("git", ["-C", "vendor/icosa-sketch-assets", "status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8" }).trim()) throw new Error("Audio audit requires a clean pinned asset corpus.");
const nativeFile = "reference/Assets/Scripts/VisualizerManager.cs";
const nativeBytes = await readFile(nativeFile);
const nativeInputs = [...new Set([...nativeBytes.toString().matchAll(/Shader\.SetGlobal(?:Vector|Texture)\("([^"]+)"/g)].map(match => match[1]))].sort();
if (nativeInputs.length !== 6) throw new Error("Native audio global contract changed; review before classifying variants.");
const compiled = await build({ entryPoints: ["src/brushes/brush-audio-support.ts"], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
const { getBrushAudioReactivity, inspectBrushAudioInputs } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const shaderFiles = [];
async function visit(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await visit(file);
    else if (entry.name.endsWith(".glsl")) {
      const bytes = await readFile(file);
      shaderFiles.push({ file: file.split(path.sep).join("/"), sha256: hash(bytes), ...inspectBrushAudioInputs(bytes.toString(), nativeInputs) });
    }
  }
}
await visit("vendor/icosa-sketch-assets/brushes");
if (!shaderFiles.length) throw new Error("Maintained shader corpus is empty.");
const assetsBytes = await readFile("src/brushes/generated/brush-assets.json");
const manifestBytes = await readFile("src/brushes/generated/exportManifest.json");
const assets = JSON.parse(assetsBytes), manifest = JSON.parse(manifestBytes);
const brushes = Object.entries(assets.brushes).filter(([, brush]) => brush.catalogSection && !brush.tags?.includes("broken") && (brush.tags?.includes("default") || brush.tags?.includes("experimental")))
  .map(([guid, brush]) => ({ guid, name: manifest.brushes[guid].name, ...getBrushAudioReactivity(brush.tags ?? []) }));
if (brushes.length !== 95) throw new Error("Required brush catalog changed; review audio classification scope.");
const matches = shaderFiles.filter(file => file.audioUniforms.length || file.nativeInputReferences.length);
const report = { recordedAt: new Date().toISOString(), scope: "Native GUI tags and known native audio bindings versus maintained GLSL source; no audio-signal or rendered-response validation",
  nativeReferenceCommit: revision, runtimeAssetCommit: assetRevision, nativeInputs, nativeSource: { file: nativeFile, sha256: hash(nativeBytes) },
  counts: { required: brushes.length, nativeTagged: brushes.filter(brush => brush.nativeTagged).length, nonReactive: brushes.length, shaderFiles: shaderFiles.length, audioInputShaderFiles: matches.length },
  brushes, shaderFiles, sourceHashes: { "src/brushes/generated/brush-assets.json": hash(assetsBytes), "src/brushes/generated/exportManifest.json": hash(manifestBytes),
    "src/brushes/brush-asset-base-url.ts": hash(assetResolverBytes),
    ...Object.fromEntries(await Promise.all(["src/brushes/brush-audio-support.ts", "src/brushes/brush-inventory.ts", "src/brushes/brush-shader-library.ts", "scripts/audit-brush-audio-reactivity.mjs", "package-lock.json"].map(async file => [file, hash(await readFile(file))]))) } };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(`Audio audit: ${brushes.length} required brushes, ${report.counts.nativeTagged} native-tagged, ${shaderFiles.length} maintained shader files, ${matches.length} audio-input matches. Report: ${output}`);
if (matches.length) throw new Error("Maintained audio inputs changed; non-reactive classification needs review.");
