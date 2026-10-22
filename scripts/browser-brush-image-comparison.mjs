import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";
import sharp from "sharp";
import { compareBrushImageFiles } from "./compare-brush-images.mjs";
import { validateBrushCapture } from "./brush-capture-contract.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = (data) => createHash("sha256").update(data).digest("hex");

async function main() {
  const { values } = parseArgs({ options: {
    references: { type: "string" }, output: { type: "string" },
    url: { type: "string" }, paired: { type: "string" },
    brush: { type: "string", multiple: true }, visible: { type: "boolean", default: false },
    "attribute-probe": { type: "boolean", default: false },
  } });
  if (!values.references || !values.output) throw new Error("Usage: node scripts/browser-brush-image-comparison.mjs --references <PNG directory> --output <new directory> [--url <runtime URL>] [--paired <native capture directory>] [--brush <GUID or name>]");
  const references = path.resolve(values.references);
  const output = path.resolve(values.output);
  const assetBytes = await readFile(path.join(root, "src/brushes/generated/brush-assets.json"));
  const assets = JSON.parse(assetBytes);
  const manifest = JSON.parse(await readFile(path.join(root, "src/brushes/generated/exportManifest.json"), "utf8"));
  const required = Object.entries(assets.brushes).filter(([, b]) => b.catalogSection &&
    !b.tags?.includes("broken") && (b.tags?.includes("default") || b.tags?.includes("experimental")))
    .map(([guid, b]) => ({ guid, name: b.durableName || b.name || manifest.brushes[guid]?.name }));
  if (!required.length) throw new Error("Required inventory is empty.");
  let selected = required;
  if (values.brush?.length) {
    selected = values.brush.map((query) => {
      const matches = required.filter((b) => b.guid.toLowerCase() === query.toLowerCase() || b.name.toLowerCase() === query.toLowerCase());
      if (matches.length !== 1) throw new Error(`Expected one required brush for ${query}.`);
      return matches[0];
    });
    if (new Set(selected.map((b) => b.guid)).size !== selected.length) throw new Error("Duplicate brush selection.");
  }
  if (values.paired) {
    const status = JSON.parse(await readFile(path.join(values.paired, "status.json"), "utf8"));
    if (status.state !== "complete") throw new Error("Paired native capture is not complete; failed or partial reference sets cannot be compared.");
  }
  const inputs = [];
  // Check every selected reference before launching a browser. Never resize a corpus silently.
  for (const brush of selected) {
    const file = `brush-${brush.name}.png`;
    const bytes = await readFile(path.join(references, file));
    const { width, height } = await sharp(bytes).metadata();
    if (width !== height || ![1024, 2048].includes(width)) throw new Error(`Unsupported reference dimensions for ${file}: ${width}x${height}.`);
    let paired;
    if (values.paired) {
      const fixtureFile = path.join(values.paired, "fixtures", `brush-${brush.name}.mesh.json`);
      const captureFile = path.join(values.paired, "fixtures", `brush-${brush.name}.capture.json`);
      const fixtureBytes = await readFile(fixtureFile);
      const captureBytes = await readFile(captureFile);
      paired = { payload: { fixture: JSON.parse(fixtureBytes.toString("utf8").replace(/^\uFEFF/, "")), capture: JSON.parse(captureBytes) },
        fixtureSha256: hash(fixtureBytes), captureSha256: hash(captureBytes) };
      if (paired.payload.capture.width !== width || paired.payload.capture.height !== height) throw new Error(`Native image dimensions differ from capture metadata for ${file}.`);
    }
    inputs.push({ ...brush, file, bytes, size: width, sha256: hash(bytes), paired });
  }
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output); // Reject an existing destination rather than mixing runs.
  await mkdir(path.join(output, "browser"));
  await mkdir(path.join(output, "reference"));
  await mkdir(path.join(output, "logs"));
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const report = {
    schemaVersion: 1, startedAt: new Date().toISOString(), completedAt: null,
    appRevision: git.status === 0 ? git.stdout.trim() : null,
    runnerSha256: hash(await readFile(fileURLToPath(import.meta.url))), inventorySha256: hash(assetBytes),
    packageLockSha256: hash(await readFile(path.join(root, "package-lock.json"))),
    packages: Object.fromEntries(["three-icosa", "three-tiltloader"].map((key) => [key, pkg.dependencies[key]])),
    scope: values.paired ? "native-input image diagnostics" : "legacy-fixture image diagnostics; reference capture provenance and fixture alignment unverified",
    requiredBrushCount: required.length, selectedBrushCount: selected.length,
    imageParity: "unverified; no calibrated image-error thresholds or parity pass is assigned",
    referenceDirectory: references, browserVersion: null, browserBackend: null, results: [],
  };
  const reportPath = path.join(output, "results.json");
  const save = () => writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  let server;
  let browser;
  let serverOutput = "";
  let url = values.url;
  try {
    if (!url) {
      const html = await readFile(path.join(root, "dist/index.html"));
      report.buildIndexSha256 = hash(html);
      url = "http://127.0.0.1:4186/";
      server = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", "4186", "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      const collect = (data) => { serverOutput = (serverOutput + data).slice(-5000); };
      server.stdout.on("data", collect); server.stderr.on("data", collect);
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null) throw new Error(`Owned preview server exited: ${serverOutput.slice(-1000)}`);
        try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error("Owned preview server did not start.");
    }
    report.runtimeUrl = url;
    browser = await chromium.launch({ channel: "chrome", headless: !values.visible,
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
    report.browserVersion = browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    for (const input of inputs) {
      const row = { guid: input.guid, name: input.name, size: input.size,
        referenceSha256: input.sha256, status: "pending" };
      report.results.push(row);
      const messages = [];
      const page = await context.newPage();
      page.on("console", (m) => messages.push(`[${m.type()}] ${m.text()}`));
      page.on("pageerror", (e) => messages.push(`[pageerror] ${e.message}`));
      try {
        const target = new URL(url);
        target.searchParams.set("visual-conformance", "brush");
        target.searchParams.set("brush-guid", input.guid);
        target.searchParams.set("conformance-size", String(input.size));
        if (values["attribute-probe"]) target.searchParams.set("conformance-attribute-probe", "1");
        if (input.paired) {
          const inputUrl = new URL("__openbrush_native_capture_input__", target);
          await page.route(inputUrl.href, (route) => route.fulfill({ json: input.paired.payload }));
          target.searchParams.set("conformance-input", inputUrl.href);
          row.fixtureSha256 = input.paired.fixtureSha256;
          row.captureSha256 = input.paired.captureSha256;
        }
        await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 120000 });
        await page.waitForFunction(() => document.documentElement.dataset.brushVisualConformance, undefined, { timeout: 120000 });
        const capture = await page.evaluate(() => {
          const panel = document.getElementById("brush-visual-conformance");
          const canvas = panel?.querySelector("canvas");
          if (!canvas) throw new Error("Visual conformance did not produce a pixel canvas.");
          const worldCanvas = document.querySelector("#scene-container canvas");
          const gl = worldCanvas?.getContext("webgl2");
          const debug = gl?.getExtension("WEBGL_debug_renderer_info");
          return { png: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height,
            shaderCompileAudit: panel.dataset.shaderCompileAudit ? JSON.parse(panel.dataset.shaderCompileAudit) : null,
            attributeDefaultProbe: panel.dataset.attributeDefaultProbe ? JSON.parse(panel.dataset.attributeDefaultProbe) : null,
            generatedUv0Size: Number(panel.dataset.generatedUv0Size), shaderUv0Size: Number(panel.dataset.shaderUv0Size),
            profile: panel.dataset.inputProfile, coverage: Number(panel.dataset.coveredPixelRatio),
            renderStatus: document.documentElement.dataset.brushVisualConformance,
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null };
        });
        row.shaderCompileAudit = capture.shaderCompileAudit;
        row.attributeDefaultProbe = capture.attributeDefaultProbe;
        if (values["attribute-probe"] && !capture.attributeDefaultProbe) throw new Error("Requested attribute-default probe is missing; rebuild the runtime.");
        validateBrushCapture(capture, input.size, Boolean(input.paired));
        const png = Buffer.from(capture.png.split(",")[1], "base64");
        const actualFile = path.join(output, "browser", input.file);
        const referenceFile = path.join(output, "reference", input.file);
        await writeFile(actualFile, png); await writeFile(referenceFile, input.bytes);
        row.browserSha256 = hash(png);
        row.inputProfile = capture.profile;
        row.generatedUv0Size = capture.generatedUv0Size;
        row.shaderUv0Size = capture.shaderUv0Size;
        row.renderStatus = capture.renderStatus;
        row.gpuReadbackCoverage = capture.coverage;
        row.metrics = await compareBrushImageFiles(actualFile, referenceFile);
        // Detect PNG/canvas conversion loss, especially additive RGB at zero target alpha.
        if (Math.abs(row.metrics.actual.coveredPixelRatio - capture.coverage) > 1e-6) throw new Error("PNG coverage differs from GPU readback coverage.");
        row.status = "captured";
        report.browserBackend ??= capture.renderer;
      } catch (error) { row.status = "capture-failed"; row.error = String(error.message || error); }
      finally {
        await page.close();
        row.consoleErrorCount = messages.filter((message) => message.startsWith("[error]")).length;
        row.pageErrorCount = messages.filter((message) => message.startsWith("[pageerror]")).length;
        if (row.status === "captured" && (row.consoleErrorCount || row.pageErrorCount)) row.status = "captured-with-errors";
        await writeFile(path.join(output, "logs", `${input.guid}.txt`), `${messages.join("\n")}\n`);
      }
      await save();
      if (report.results.length % 5 === 0 || row.status !== "captured") console.log(`Captured ${report.results.length}/${selected.length}; ${input.name}: ${row.status}`);
    }
    report.completedAt = new Date().toISOString();
    report.capturedBrushCount = report.results.filter((r) => r.status === "captured").length;
    report.nonemptyBrushCount = report.results.filter((r) => r.renderStatus === "pass").length;
    await save();
    console.log(`Browser image diagnostics: ${report.capturedBrushCount}/${selected.length} captured; ${report.nonemptyBrushCount} nonempty. ${reportPath}`);
    if (report.capturedBrushCount !== selected.length || report.nonemptyBrushCount !== selected.length) process.exitCode = 1;
  } finally { await browser?.close(); server?.kill(); }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
