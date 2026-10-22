import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium } from "playwright";

async function main() {
  const { values } = parseArgs({ options: { output: { type: "string" }, url: { type: "string" } } });
  if (!values.output) throw new Error("Usage: node scripts/browser-layer-state.mjs --output <new directory> [--url <existing Vite URL>]. Run type checking and npx iwsdk xr status first.");
  await mkdir(path.dirname(path.resolve(values.output)), { recursive: true });
  await mkdir(values.output);
  const messages = [], pageErrors = [];
  let browser, server, serverError, serverLog = "";
  try {
    const url = values.url ?? "http://127.0.0.1:4196/";
    if (!values.url) {
      server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--mode", "mirror-http", "--host", "127.0.0.1", "--port", "4196", "--strictPort", "--open", "false"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      server.on("error", error => { serverError = error.message; });
      const collect = bytes => { serverLog = (serverLog + bytes).slice(-12000); };
      server.stdout.on("data", collect); server.stderr.on("data", collect);
      let ready = false;
      for (const deadline = Date.now() + 60000; Date.now() < deadline;) {
        if (serverError || server.exitCode !== null) throw new Error(serverError ?? "Owned Vite server exited");
        try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!ready) throw new Error("Owned Vite server did not become ready");
    }
    browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
    const page = await browser.newPage();
    page.on("console", message => messages.push({ type: message.type(), text: message.text().slice(0, 1000) }));
    page.on("pageerror", error => pageErrors.push(error.stack ?? error.message));
    await page.goto(new URL("scripts/layer-state-harness.html", url).href, { timeout: 120000 });
    await page.waitForFunction(() => window.layerStateResult || window.layerStateError, undefined, { timeout: 120000 });
    const result = await page.evaluate(() => ({ result: window.layerStateResult, error: window.layerStateError }));
    const sourceFiles = ["src/app/layer-state-validation.ts", "src/systems/layer-canvas-system.ts", "src/systems/sketch-library-system.ts", "src/sketch/tilt-file.ts", "src/components/core.ts", "scripts/layer-state-harness.html", "scripts/browser-layer-state.mjs", "package-lock.json"];
    const report = { recordedAt: new Date().toISOString(), browserVersion: browser.version(), ...result,
      consoleErrors: messages.filter(message => message.type === "error").length,
      graphicsWarnings: messages.filter(message => /WebGL.*(?:INVALID_|error)|GL_INVALID|framebuffer.*incomplete/i.test(message.text)).length,
      pageErrors,
      sourceHashes: Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash("sha256").update(await readFile(file)).digest("hex")]))), };
    await writeFile(path.join(values.output, "results.json"), JSON.stringify(report, null, 2) + "\n");
    await writeFile(path.join(values.output, "browser-log.json"), JSON.stringify({ messages, pageErrors }, null, 2) + "\n");
    if (report.error || report.result?.passed !== true || report.consoleErrors || report.graphicsWarnings || pageErrors.length) throw new Error(report.error ?? "Browser layer audit contains failed assertions/errors/warnings");
    console.log("Layer runtime audit passed: restored names/visibility, active layer, hidden-stroke visibility, reset, selection-canvas retention.");
  } finally {
    await browser?.close(); server?.kill();
    await writeFile(path.join(values.output, "server.txt"), serverLog);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
