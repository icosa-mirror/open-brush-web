import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import path from "node:path";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const scopes = ["Assets/Scripts/Brushes", "Assets/Resources/Brushes", "Assets/Resources/X/Brushes", "Assets/Manifest.asset",
  "Assets/Manifest_Experimental.asset", "Assets/Shaders", "Assets/Scripts/Export",
  "Assets/Editor/UiScreenshotter.cs", "Assets/Editor/BrushMeshFixtureWriter.cs"];

function git(repository, args, input) {
  const result = spawnSync("git", ["-C", repository, ...args], { input, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Git ${args[0]} failed: ${result.stderr.toString().slice(0, 400)}`);
  return result.stdout;
}

function tree(repository, revision) {
  const entries = git(repository, ["ls-tree", "-r", "-z", revision, "--", ...scopes]).toString().split("\0").filter(Boolean);
  return new Map(entries.map(entry => {
    const [header, file] = entry.split("\t");
    return [file, header.split(" ")[2]];
  }));
}

function descriptorFields(text) {
  const fields = new Map();
  let key;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const match = /^  ([A-Za-z_][\w]*):/.exec(line);
    if (match) { key = match[1]; fields.set(key, []); }
    if (key) fields.get(key).push(line);
  }
  return new Map([...fields].map(([key, lines]) => [key, lines.join("\n").trimEnd()]));
}

function descriptors(repository, files) {
  const assets = [...files].filter(([file]) => /^Assets\/Resources\/(?:X\/)?Brushes\//.test(file) && file.endsWith(".asset"));
  const output = git(repository, ["cat-file", "--batch"], assets.map(([, oid]) => oid).join("\n") + "\n");
  const records = new Map();
  let offset = 0;
  for (const [file, oid] of assets) {
    const end = output.indexOf(10, offset);
    const header = output.subarray(offset, end).toString().split(" ");
    const size = Number(header[2]);
    if (header[0] !== oid || header[1] !== "blob" || !Number.isSafeInteger(size)) throw new Error(`Invalid blob: ${file}`);
    const text = output.subarray(end + 1, end + 1 + size).toString();
    offset = end + 1 + size + 1;
    const guid = /m_Guid:\s*\r?\n\s*m_storage:\s*([a-f0-9-]{36})/i.exec(text)?.[1].toLowerCase();
    if (!guid) continue;
    if (records.has(guid)) throw new Error(`Duplicate descriptor GUID: ${guid}`);
    records.set(guid, { file, gitBlob: oid, fields: descriptorFields(text) });
  }
  return records;
}

async function main() {
  const { values } = parseArgs({ options: { repository: { type: "string" }, output: { type: "string" } } });
  if (!values.repository || !values.output) throw new Error("Usage: node scripts/audit-native-reference.mjs --repository <native checkout> --output <new directory>");
  const referenceBytes = await readFile("open-brush-reference.json");
  const nativeBytes = await readFile("docs/evidence/brush-fidelity/native-2026-10-21/manifest.json");
  const inventoryBytes = await readFile("src/brushes/generated/brush-assets.json");
  const exportManifestBytes = await readFile("src/brushes/generated/exportManifest.json");
  const exportManifest = JSON.parse(exportManifestBytes);
  const reference = JSON.parse(referenceBytes), native = JSON.parse(nativeBytes), inventory = JSON.parse(inventoryBytes);
  const declared = tree(values.repository, reference.commit), generated = tree(values.repository, native.nativeRevision);
  const before = descriptors(values.repository, declared), after = descriptors(values.repository, generated);
  const changedPaths = [...new Set([...declared.keys(), ...generated.keys()])].sort()
    .filter(file => declared.get(file) !== generated.get(file))
    .map(file => ({ file, declaredGitBlob: declared.get(file) ?? null, generatedGitBlob: generated.get(file) ?? null,
      status: !declared.has(file) ? "added" : !generated.has(file) ? "deleted" : "modified" }));
  const required = Object.entries(inventory.brushes).filter(([, brush]) => brush.catalogSection && !brush.tags?.includes("broken") && (brush.tags?.includes("default") || brush.tags?.includes("experimental")));
  const brushes = required.map(([guid, brush]) => {
    const a = before.get(guid), b = after.get(guid);
    if (!a || !b) throw new Error(`Missing required descriptor at one revision: ${guid}`);
    const changedFields = [...new Set([...a.fields.keys(), ...b.fields.keys()])].sort().filter(key => a.fields.get(key) !== b.fields.get(key));
    return { guid, name: exportManifest.brushes[guid].name, declared: { file: a.file, gitBlob: a.gitBlob },
      generated: { file: b.file, gitBlob: b.gitBlob }, changedFields,
      descriptorBytesEqual: a.gitBlob === b.gitBlob,
      runtimeEquivalence: "unverified" };
  });
  const report = { schemaVersion: 1, recordedAt: new Date().toISOString(),
    scope: "Read-only Git blob and serialized descriptor-field comparison; not a dependency closure or runtime-equivalence test",
    declaredRevision: reference.commit, generatedRevision: native.nativeRevision,
    referenceConfigurationSha256: hash(referenceBytes), nativeGenerationManifestSha256: hash(nativeBytes), inventorySha256: hash(inventoryBytes), exportManifestSha256: hash(exportManifestBytes),
    runnerSha256: hash(await readFile("scripts/audit-native-reference.mjs")), scopes,
    counts: { changedPaths: changedPaths.length, changedGeneratorSources: changedPaths.filter(row => row.file.startsWith("Assets/Scripts/Brushes/") && row.file.endsWith(".cs")).length,
      requiredBrushes: brushes.length, changedDescriptors: brushes.filter(row => !row.descriptorBytesEqual).length,
      descriptorsWithChangedFields: brushes.filter(row => row.changedFields.length).length }, changedPaths, brushes };
  await mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
  await mkdir(values.output);
  await writeFile(path.join(values.output, "results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.counts));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
