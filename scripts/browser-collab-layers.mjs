import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseArgs, isDeepStrictEqual } from "node:util";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium } from "playwright";

const check = (condition, message) => { if (!condition) throw new Error(message); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const { values } = parseArgs({ options: { output: { type: "string" }, url: { type: "string" } } });
  if (!values.output) throw new Error("Usage: node scripts/browser-collab-layers.mjs --output <new directory> [--url <existing Vite URL>]. Type-check and check npx iwsdk xr status first.");
  await mkdir(path.dirname(path.resolve(values.output)), { recursive: true }); await mkdir(values.output);
  const stages = [], errors = [], messages = [], browsers = [];
  let server, serverError, serverLog = "", host, guest;
  const report = { startedAt: new Date().toISOString(), scope: "Two private desktop browser peers using application PeerJS transport, controlled layer poses and synthetic mouse input; no native pixels or physical XR", stages };
  try {
    const base = values.url ?? "http://localhost:4197/";
    if (!values.url) {
      server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--mode", "mirror-http", "--host", "127.0.0.1", "--port", "4197", "--strictPort", "--open", "false"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      server.on("error", error => { serverError = error.message; });
      const collect = bytes => { serverLog = (serverLog + bytes).slice(-12000); };
      server.stdout.on("data", collect); server.stderr.on("data", collect);
      let ready = false;
      for (const deadline = Date.now() + 60000; Date.now() < deadline;) {
        if (serverError || server.exitCode !== null) throw new Error(serverError ?? "Owned server exited");
        try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
        await pause(100);
      }
      check(ready, "Owned server did not become ready");
    }
    const setup = async role => {
      const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
      browsers.push(browser); report.browserVersion = browser.version();
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on("pageerror", error => errors.push({ role, stack: error.stack ?? error.message }));
      page.on("console", message => messages.push({ role, type: message.type(), text: message.text().slice(0, 1000) }));
      const ready = page.waitForEvent("console", { predicate: message => /OpenBrush brush shader materials ready: \d+\/\d+ supported brushes\./.test(message.text()), timeout: 180000 });
      void ready.catch(() => undefined);
      const url = new URL(base); url.searchParams.set("batch-validation", "delayed"); url.searchParams.set("strokeBatches", "1");
      await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForFunction(() => window.strokeBatchPersistence && window.__openbrushCollab, undefined, { timeout: 180000 });
      const counts = (await ready).text().match(/ready: (\d+)\/(\d+)/);
      check(counts && counts[1] === counts[2], `${role}: materials incomplete`);
      await page.evaluate(() => { window.__openbrushCollab.debugEnterSketch(); window.inspectStrokeBatchHistory(true); });
      return page;
    };
    host = await setup("host"); guest = await setup("guest");
    console.log("Collab layer test: private application pages ready.");
    const observe = page => page.evaluate(async () => {
      const { LayerCanvasSystem } = await import("/src/systems/layer-canvas-system.ts");
      const { StrokeAuthoringSystem } = await import("/src/systems/stroke-authoring-system.ts");
      const { BrushStroke } = await import("/src/components/core.ts");
      const collab = window.__openbrushCollab, layers = collab.world.getSystem(LayerCanvasSystem), authoring = collab.world.getSystem(StrokeAuthoringSystem);
      const data = window.strokeBatchPersistence.snapshot();
      return { network: collab.debugState(), layers: layers ? collab.world.getSystem((await import("/src/systems/sketch-library-system.ts")).SketchLibrarySystem).collectSharedLayers() : [], data,
        render: [...authoring.queries.strokes.entities].map(entity => ({ guid: String(entity.getValue(BrushStroke, "guid")), layerIndex: Number(entity.getValue(BrushStroke, "layerIndex")), renderVisible: Boolean(entity.getValue(BrushStroke, "renderVisible")), parentName: entity.object3D?.parent?.name })), counter: authoring.strokeCounter };
    });
    const save = async stage => {
      const row = { stage, host: await observe(host), guest: await observe(guest) };
      stages.push(row); await writeFile(path.join(values.output, "results.json"), JSON.stringify(report, null, 2) + "\n"); return row;
    };
    const initial = await host.evaluate(async () => {
      const { LayerCanvasSystem } = await import("/src/systems/layer-canvas-system.ts");
      const { StrokeAuthoringSystem } = await import("/src/systems/stroke-authoring-system.ts");
      const { SketchLibrarySystem } = await import("/src/systems/sketch-library-system.ts");
      const collab = window.__openbrushCollab, layers = collab.world.getSystem(LayerCanvasSystem);
      layers.setLayers([
        { id: 0, name: "Shared " + "x".repeat(1400), visible: true, locked: false, transform: { position: [0.3, -0.2, 0.4], rotation: [0.5499787330627441, 0.49989476799964905, 0.1931496560573578, 0.6405637264251709], scale: 1.6 } },
        { id: 4, name: "Hidden locked", visible: false, locked: true, transform: { position: [-0.2, 0, 0.1], rotation: [0, 0, 0, 1], scale: 0.5 } },
      ]);
      const guid = collab.debugCommitTestStroke();
      const data = structuredClone(collab.world.getSystem(SketchLibrarySystem).collectVisibleStrokeData().find(stroke => stroke.guid === guid));
      data.guid = "hidden-fixture-" + crypto.randomUUID(); data.layerIndex = 4;
      collab.world.getSystem(StrokeAuthoringSystem).spawnStrokeFromData(data, true);
      return { guid, hiddenGuid: data.guid };
    });
    await guest.evaluate(() => {
      const collab = window.__openbrushCollab, original = collab.onMessage.bind(collab), pending = [];
      let hold = true;
      collab.onMessage = raw => { if (hold && raw?.t !== "snapshot" && raw?.t !== "hello") pending.push(raw); else original(raw); };
      window.releaseLayerContext = () => { hold = false; for (const message of pending) original(message); pending.length = 0; };
    });
    await host.evaluate(() => window.__openbrushCollab.toggleHosting());
    await host.waitForFunction(() => window.__openbrushCollab.peer?.open && window.__openbrushCollab.debugState().phase === "hosting", undefined, { timeout: 60000 });
    const code = await host.evaluate(() => window.__openbrushCollab.debugState().code);
    await guest.evaluate(code => window.__openbrushCollab.joinWithCode(code), code);
    await guest.waitForFunction(() => window.__openbrushCollab.debugState().recentOps.includes("snapshot") && !window.__openbrushCollab.debugState().layerContextReady, undefined, { timeout: 60000 });
    await guest.mouse.move(560, 350); await guest.mouse.down(); await pause(400);
    const blocked = await guest.evaluate(async () => {
      const { StrokeAuthoringSystem } = await import("/src/systems/stroke-authoring-system.ts");
      const authoring = window.__openbrushCollab.world.getSystem(StrokeAuthoringSystem);
      const command = [...authoring.queries.commands.entities][0];
      return { active: Boolean(authoring.activeStroke), strokes: window.strokeBatchPersistence.snapshot().length, pressed: Boolean(command?.getValue((await import("/src/components/core.ts")).InputCommandState, "paintPressed")) };
    });
    await guest.mouse.up(); check(blocked.pressed && !blocked.active && blocked.strokes === 0, "Guest authored before shared context was installed");
    report.blockedInput = blocked;
    await guest.evaluate(() => window.releaseLayerContext());
    for (const page of [host, guest]) await page.waitForFunction(() => { const state = window.__openbrushCollab.debugState(); return state.connected && state.layerContextReady && state.remoteContextReady; }, undefined, { timeout: 60000 });
    await guest.waitForFunction(guid => window.strokeBatchPersistence.snapshot().some(stroke => stroke.guid === guid), initial.hiddenGuid, { timeout: 30000 });
    await pause(300);
    const synced = await save("posed-snapshot");
    const retryBudget = page => page.evaluate(() => window.__openbrushCollab.reconnectAttemptsLeft);
    report.initialRetryBudgets = await Promise.all([retryBudget(host), retryBudget(guest)]);
    check(report.initialRetryBudgets.every(value => value > 0), "First connection has no recovery budget");
    check(isDeepStrictEqual(synced.host.layers, synced.guest.layers), "Peer layer definitions differ");
    check(synced.guest.data.length === 2 && synced.guest.render.find(row => row.guid === initial.hiddenGuid)?.renderVisible === false, "Hidden layer snapshot was lost or rendered");
    check(synced.guest.render.every(row => row.parentName === `OpenBrushLayer_${row.layerIndex}`), "Received stroke did not use its layer parent");
    const compare = (row, guid) => {
      const a = row.host.data.find(stroke => stroke.guid === guid), b = row.guest.data.find(stroke => stroke.guid === guid);
      check(a && b && isDeepStrictEqual(a, b), "Peer layer-local stroke fields differ");
    };
    compare(synced, initial.guid); compare(synced, initial.hiddenGuid);
    const moduleCounter = page => page.evaluate(async () => {
      const { StrokeAuthoringSystem } = await import("/src/systems/stroke-authoring-system.ts");
      window.inspectStrokeBatchHistory(true); window.__openbrushCollab.world.getSystem(StrokeAuthoringSystem).strokeCounter = 100000;
    });
    await Promise.all([moduleCounter(host), moduleCounter(guest)]);
    await Promise.all([host.mouse.move(560, 350), guest.mouse.move(560, 420)]);
    await Promise.all([host.mouse.down(), guest.mouse.down()]); await pause(200);
    const activeGuid = page => page.evaluate(async () => window.__openbrushCollab.world.getSystem((await import("/src/systems/stroke-authoring-system.ts")).StrokeAuthoringSystem).activeStroke?.strokeData.guid);
    const hostGuid = await activeGuid(host), guestGuid = await activeGuid(guest);
    check(hostGuid && guestGuid && hostGuid !== guestGuid, "Peers generated colliding stroke IDs at the same counter");
    const move = async (page, y) => { for (let i = 0; i < 24; i++) { await page.mouse.move(570 + i * 8, y + Math.sin(i * 0.3) * 12); await pause(50); } await page.mouse.up(); };
    await Promise.all([move(host, 350), move(guest, 420)]);
    await host.waitForFunction(guid => window.strokeBatchPersistence.snapshot().some(stroke => stroke.guid === guid), guestGuid, { timeout: 30000 });
    await guest.waitForFunction(guid => window.strokeBatchPersistence.snapshot().some(stroke => stroke.guid === guid), hostGuid, { timeout: 30000 });
    const simultaneous = await save("simultaneous-authoring"); compare(simultaneous, hostGuid); compare(simultaneous, guestGuid);
    report.distinctConcurrentStrokeIds = true;
    await guest.keyboard.press("z");
    await host.waitForFunction(guid => !window.strokeBatchPersistence.snapshot().some(stroke => stroke.guid === guid), guestGuid, { timeout: 30000 });
    await guest.keyboard.press("y");
    await host.waitForFunction(guid => window.strokeBatchPersistence.snapshot().some(stroke => stroke.guid === guid), guestGuid, { timeout: 30000 });
    compare(await save("guest-undo-redo"), guestGuid);
    await guest.evaluate(() => window.__openbrushCollab.conn.close());
    await guest.waitForFunction(() => window.__openbrushCollab.debugState().phase === "reconnecting", undefined, { timeout: 10000 });
    await guest.evaluate(() => { window.__openbrushCollab.reconnectDelay = 120; });
    const beforeOffline = new Set((await observe(guest)).data.map(stroke => stroke.guid));
    await guest.mouse.move(560, 430); await guest.mouse.down(); await move(guest, 430); await pause(300);
    const offline = await observe(guest), offlineGuid = offline.data.find(stroke => !beforeOffline.has(stroke.guid))?.guid;
    check(offlineGuid && offline.network.layerContextReady, "Guest could not author in retained context while disconnected");
    await guest.evaluate(() => { window.__openbrushCollab.reconnectDelay = 0; });
    await host.waitForFunction(guid => window.strokeBatchPersistence.snapshot().some(stroke => stroke.guid === guid), offlineGuid, { timeout: 60000 });
    const reconnected = await save("reconnected-offline-merge"); compare(reconnected, offlineGuid);
    check(isDeepStrictEqual(reconnected.host.layers, reconnected.guest.layers), "Reconnection changed layer context");
    const guestCount = reconnected.guest.data.length;
    await host.evaluate(async () => window.__openbrushCollab.world.getSystem((await import("/src/systems/sketch-library-system.ts")).SketchLibrarySystem).startNewSketch());
    for (const page of [host, guest]) await page.waitForFunction(() => window.__openbrushCollab.debugState().phase === "idle", undefined, { timeout: 15000 });
    check((await observe(guest)).data.length === guestCount, "Leaving shared sketch deleted peer work");
    report.sessionReplacementRetainsPeerWork = true;
    await host.evaluate(() => window.__openbrushCollab.onMessage({ t: "hello", version: 2 }));
    check((await host.evaluate(() => window.inspectStrokeBatchHistory().collab.status)) === "error", "Older protocol hello was not explicitly rejected");
    report.olderHelloRejected = true;
    report.completedAt = new Date().toISOString();
    console.log("Collab layers passed: posed snapshot, blocked early input, unique concurrent strokes, undo/redo, offline replay, session replacement and version rejection.");
  } catch (error) { report.error = error.stack ?? error.message; throw error; }
  finally {
    if (host) await host.evaluate(() => window.__openbrushCollab?.teardown("Test finished", "ended")).catch(() => undefined);
    if (guest) await guest.evaluate(() => window.__openbrushCollab?.teardown("Test finished", "ended")).catch(() => undefined);
    for (const browser of browsers) await browser.close(); server?.kill();
    report.pageErrors = errors; report.consoleErrors = messages.filter(message => message.type === "error");
    report.graphicsWarnings = messages.filter(message => /WebGL.*(?:INVALID_|error)|GL_INVALID|framebuffer.*incomplete/i.test(message.text));
    const files = ["src/collab/protocol.ts", "src/collab/layer-context.ts", "src/systems/collab-system.ts", "src/systems/sketch-library-system.ts", "src/systems/stroke-authoring-system.ts", "src/systems/layer-canvas-system.ts", "src/sketch/layer-transform.ts", "src/components/core.ts", "scripts/browser-collab-layers.mjs", "package-lock.json"];
    report.sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file, createHash("sha256").update(await readFile(file)).digest("hex")])));
    await writeFile(path.join(values.output, "results.json"), JSON.stringify(report, null, 2) + "\n");
    await writeFile(path.join(values.output, "browser-log.json"), JSON.stringify({ messages, errors }, null, 2) + "\n");
    await writeFile(path.join(values.output, "server.txt"), serverLog);
    check(!errors.length && !report.consoleErrors.length && !report.graphicsWarnings.length, "Browser/graphics errors recorded");
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
