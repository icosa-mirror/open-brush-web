import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { readFixtureGlb } from "./unity-glb-export-contract.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: "string", multiple: true }, output: { type: "string" }, url: { type: "string" },
  } });
  if (!values.input?.length || !values.output) throw new Error("Usage: node scripts/browser-export-inspection.mjs --input <embedded GLB> [--input <GLB> ...] --output <new directory> [--url <existing Vite dev URL>]. Check `npx iwsdk xr status` before starting an owned server.");
  const inputs = [];
  for (const file of values.input) {
    const bytes = await readFile(path.resolve(file));
    const { json } = readFixtureGlb(bytes);
    if (json.images?.some((image) => image.uri && !image.uri.startsWith("data:"))) throw new Error("External image URIs require beforeRoot and are outside this diagnostic.");
    inputs.push({ name: path.basename(file), bytes, sha256: hash(bytes) });
  }
  const output = path.resolve(values.output);
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output); // Never mix runs.
  const report = {
    schemaVersion: 1, startedAt: new Date().toISOString(),
    appRevision: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(),
    runnerSha256: hash(await readFile(fileURLToPath(import.meta.url))),
    helperSha256: hash(await readFile(path.join(root, "src/brushes/brush-export-inspection.ts"))),
    lockfileSha256: hash(await readFile(path.join(root, "package-lock.json"))),
    scope: "isolated IWSDK world, shared maintained shader loader, post-three-icosa afterRoot attribute diagnostics; beforeRoot and rendering unverified",
    selectedInputCount: inputs.length,
    results: [],
  };
  let server; let browser; let serverLog = "";
  const save = () => writeFile(path.join(output, "results.json"), `${JSON.stringify(report, null, 2)}\n`);
  try {
    const url = values.url ?? "http://127.0.0.1:4191/";
    if (!values.url) {
      server = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--mode", "mirror-http", "--host", "127.0.0.1", "--port", "4191", "--strictPort", "--open", "false"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      const collect = (bytes) => { serverLog = (serverLog + bytes).slice(-10000); };
      server.stdout.on("data", collect); server.stderr.on("data", collect);
      let ready = false;
      for (let i = 0; i < 150; i++) {
        if (server.exitCode !== null) throw new Error("Owned Vite server exited; inspect server.txt.");
        try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error("Owned Vite server did not become ready.");
    }
    browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
    report.browserVersion = browser.version();
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const startupLog = createWriteStream(path.join(output, "startup.txt"));
    let startupErrors = 0;
    const startupConsole = (message) => {
      if (message.type() === "error") startupErrors++;
      startupLog.write(`[${message.type()}] ${message.text()}\n`);
    };
    const startupPageError = (error) => { startupErrors++; startupLog.write(`[pageerror] ${error.message}\n`); };
    page.on("console", startupConsole); page.on("pageerror", startupPageError);
    try {
      const harnessUrl = new URL("__export_inspection_harness__", url).href;
      await page.route(harnessUrl, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><body></body></html>" }));
      await page.goto(harnessUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.evaluate(async () => {
        const helper = await import("/src/brushes/brush-export-inspection.ts");
        await helper.initializeExportInspection();
      });
    } finally {
      page.off("console", startupConsole); page.off("pageerror", startupPageError);
      startupLog.end(); await finished(startupLog);
      report.startupErrorCount = startupErrors;
      await save();
    }
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const consoleLog = createWriteStream(path.join(output, `console-${i}.txt`));
      let consoleErrors = 0; let pageErrors = 0; let warnings = 0;
      const onConsole = (message) => {
        if (message.type() === "error") consoleErrors++;
        if (message.type() === "warning") warnings++;
        consoleLog.write(`[${message.type()}] ${message.text()}\n`);
      };
      const onPageError = (error) => { pageErrors++; consoleLog.write(`[pageerror] ${error.message}\n`); };
      const onRequestFailed = (request) => consoleLog.write(`[requestfailed] ${request.url().slice(0, 1000)} ${request.failure()?.errorText}\n`);
      page.on("console", onConsole); page.on("pageerror", onPageError);
      page.on("requestfailed", onRequestFailed);
      const row = { name: input.name, sha256: input.sha256, status: "pending" };
      report.results.push(row);
      try {
        const glbUrl = new URL(`__export_inspection_${i}.glb`, url).href;
        await page.route(glbUrl, (route) => route.fulfill({ body: input.bytes, contentType: "model/gltf-binary" }));
        let deadline;
        try {
          Object.assign(row, await Promise.race([
            page.evaluate(async ({ glbUrl }) => {
              const helper = await import("/src/brushes/brush-export-inspection.ts");
              return await helper.inspectBrushExport(glbUrl);
            }, { glbUrl }),
            new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Attribute inspection exceeded 120 seconds.")), 120000); }),
          ]));
        } finally { clearTimeout(deadline); }
        row.status = "inspected";
        row.nonfiniteValueCount = row.meshes.reduce((sum, mesh) => sum + Object.values(mesh.after.attributes).reduce((n, attribute) => n + attribute.nonfiniteCount, 0) + (mesh.after.index?.nonfiniteCount ?? 0), 0);
        row.colorMismatchCount = row.meshes.filter((mesh) => ["value-mismatch", "shape-mismatch"].includes(mesh.colorConversion.status)).length;
        if (row.nonfiniteValueCount || row.colorMismatchCount) row.status = "attribute-check-failed";
      } catch (error) { row.status = "inspection-failed"; row.error = error.message; }
      finally {
        page.off("console", onConsole); page.off("pageerror", onPageError);
        page.off("requestfailed", onRequestFailed);
        row.consoleErrorCount = consoleErrors;
        row.pageErrorCount = pageErrors;
        row.warningCount = warnings;
        if (row.status === "inspected" && (row.consoleErrorCount || row.pageErrorCount)) row.status = "inspected-with-errors";
        consoleLog.end(); await finished(consoleLog);
        await save();
      }
      console.log(`${i + 1}/${inputs.length}: ${input.name}: ${row.status}`);
      // A timed-out plugin may still have pending asynchronous work. Close the
      // browser rather than letting it contaminate later file observations.
      if (row.status !== "inspected") break;
    }
    report.notAttempted = inputs.slice(report.results.length).map(({ name, sha256 }) => ({ name, sha256, status: "not-attempted-after-failure" }));
    report.completedAt = new Date().toISOString();
    await save();
    if (startupErrors || report.results.some((row) => row.status !== "inspected")) process.exitCode = 1;
  } finally {
    await browser?.close();
    server?.kill(); // Only this process's owned server.
    await writeFile(path.join(output, "server.txt"), serverLog);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
