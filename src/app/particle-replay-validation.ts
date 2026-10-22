import { World, type Mesh, type Entity, type BufferGeometry } from "@iwsdk/core";
import { BrushStroke, OpenBrushAppState, OpenBrushScenePose } from "../components/core.js";
import { LayerCanvasSystem } from "../systems/layer-canvas-system.js";
import { StrokeAuthoringSystem } from "../systems/stroke-authoring-system.js";
import { StrokeBatchRenderSystem } from "../systems/stroke-batch-render-system.js";
import { openBrushInventory } from "../brushes/brush-catalog.js";
import { openBrushShaderLibrary } from "../brushes/brush-shader-library.js";
import { createEmptyStrokeData, type Vec3 } from "../types.js";
import type { StrokeBatchManager } from "../brushes/stroke-batch-manager.js";
import type { StrokeBatch } from "../brushes/stroke-batch.js";

function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }

export async function validateParticleReplay(container: HTMLDivElement) {
  const world = await World.create(container, { xr: false, render: { defaultLighting: false },
    features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  world.registerSystem(LayerCanvasSystem).registerSystem(StrokeBatchRenderSystem).registerSystem(StrokeAuthoringSystem);
  world.createTransformEntity().addComponent(OpenBrushAppState, { mode: "intro" });
  world.createTransformEntity().addComponent(OpenBrushScenePose);
  const frames = async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };
  await frames();
  const authoring = world.getSystem(StrokeAuthoringSystem)!;
  const runtime = authoring as unknown as { currentLevelTimeSeconds: number };
  const batching = world.getSystem(StrokeBatchRenderSystem)! as unknown as {
    manager: StrokeBatchManager; targets: Map<StrokeBatch, { geometry: BufferGeometry }>;
  };
  const rows = [];
  const births = (entity: Entity, genius: boolean) => {
    const location = batching.manager.getLocation(String(entity.getValue(BrushStroke, "guid")));
    const geometry = location ? batching.targets.get(location.batch)!.geometry : (entity.object3D as Mesh).geometry;
    const attribute = geometry.getAttribute(genius ? "a_texcoord0" : "a_texcoord1");
    const count = Number(entity.getValue(BrushStroke, "vertexCount"));
    check(count > 0 && attribute?.itemSize === 4, "Missing timed particle geometry");
    return Array.from({ length: count }, (_, i) => attribute.getW((location?.subset.startVertex ?? 0) + i));
  };
  for (const entry of openBrushInventory.filter(entry => ["GeniusParticlesBrush", "MidpointPlusLifetimeSprayBrush"].includes(entry.generatorClass ?? ""))) {
    await openBrushShaderLibrary.load(entry);
    const data = createEmptyStrokeData({ guid: `replay-${entry.guid}`, brushGuid: entry.guid, brushSize: 0.05, seed: 5,
      controlPoints: Array.from({ length: 36 }, (_, i) => ({ position: [i * 0.04, Math.sin(i * 0.1) * 0.05, -1] as Vec3,
        orientation: [0, 0, 0, 1], pressure: 1, timestampMs: 500000 + i * 20 })) });
    const serialized = JSON.stringify(data), genius = entry.generatorClass === "GeniusParticlesBrush";
    const origin = runtime.currentLevelTimeSeconds;
    const entity = authoring.spawnStrokeFromData(data, true);
    const first = births(entity, genius);
    check(first.every(value => value === Math.fround(origin)), `${entry.name}: load births are not current replay time`);
    check(JSON.stringify(entity.object3D!.userData.openBrushStrokeData) === serialized, `${entry.name}: serialized timestamps changed`);
    await frames();
    authoring.applyRemoteVisibility([data.guid], false); authoring.applyRemoteVisibility([data.guid], true);
    check(JSON.stringify(births(entity, genius)) === JSON.stringify(first), `${entry.name}: visibility changed birth phase`);
    const laterOrigin = runtime.currentLevelTimeSeconds;
    const later = authoring.spawnStrokeFromData({ ...data, guid: `${data.guid}-later` }, true);
    check(laterOrigin > origin && births(later, genius).every(value => value === Math.fround(laterOrigin)), `${entry.name}: subsequent load reused old origin`);
    rows.push({ guid: entry.guid, name: entry.name, vertices: first.length, replayOrigin: origin, laterReplayOrigin: laterOrigin,
      originalTimestampsPreserved: true, visibilityPreservesBirths: true });
  }
  check(rows.length > 0, "No timed particle brushes checked");
  return { passed: true, rows, scope: "Actual production import, binding and visibility paths in an isolated desktop browser; no native pixels, real gestures or connected-peer phase comparison" };
}
