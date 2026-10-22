import { World, Vector3, Quaternion, type Entity } from "@iwsdk/core";
import { BrushSettings, BrushStroke, InputCommandState, OpenBrushAppState, OpenBrushScenePose } from "../components/core.js";
import { LayerCanvasSystem } from "../systems/layer-canvas-system.js";
import { StrokeAuthoringSystem } from "../systems/stroke-authoring-system.js";
import { StrokeBatchRenderSystem } from "../systems/stroke-batch-render-system.js";
import { SketchLibrarySystem } from "../systems/sketch-library-system.js";
import { openBrushShaderLibrary } from "../brushes/brush-shader-library.js";
import { openBrushInventory } from "../brushes/brush-catalog.js";
import { createEmptyStrokeData, StrokeFlags, type StrokeData, type Vec3 } from "../types.js";
import { createSketchDocument } from "../sketch/document.js";
import { readTiltFile, writeTiltFile } from "../sketch/tilt-file.js";

const LIGHT = "2241cd32-8ba2-48a5-9ee7-2caef7e9ed62";
function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }

export async function validateStrokeGroups(container: HTMLDivElement) {
  const world = await World.create(container, { xr: false, render: { defaultLighting: false }, features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  world.registerSystem(LayerCanvasSystem).registerSystem(StrokeBatchRenderSystem).registerSystem(StrokeAuthoringSystem);
  world.createTransformEntity().addComponent(OpenBrushAppState, { mode: "intro" });
  world.createTransformEntity().addComponent(OpenBrushScenePose);
  world.createTransformEntity().addComponent(BrushSettings, { brushGuid: LIGHT, size: 0.03 });
  const command = world.createTransformEntity().addComponent(InputCommandState);
  for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  await openBrushShaderLibrary.load(openBrushInventory.find(entry => entry.guid === LIGHT)!);
  const authoring = world.getSystem(StrokeAuthoringSystem)!;
  const make = (guid: string, flags: StrokeFlags) => createEmptyStrokeData({ guid, flags, brushGuid: LIGHT, groupId: 0xf1234567, brushSize: 0.03, seed: 7,
    controlPoints: [[0, 0, -1], [0.1, 0.02, -1], [0.2, 0, -1]].map(position => ({ position: position as Vec3, orientation: [0, 0, 0, 1], pressure: 1, timestampMs: 0 })) });
  const importedLead = authoring.spawnStrokeFromData(make("imported-lead", StrokeFlags.None), true);
  const importedContinuation = authoring.spawnStrokeFromData(make("imported-continuation", StrokeFlags.IsGroupContinue), true);
  check(importedLead.getValue(BrushStroke, "groupId") === 0xf1234567 && importedContinuation.getValue(BrushStroke, "groupContinuation") === true, "Imported selection tag/continuation lost in ECS");
  const tools = authoring as unknown as {
    samplePosition: Vector3; sampleQuaternion: Quaternion;
    startStroke(command: Entity, time: number, pressure: number): void;
    sampleActiveStroke(time: number, pressure: number, force: boolean): void;
    finalizeActiveStroke(): void; undoLastStroke(): void; redoLastStroke(): void;
    activeStroke?: { entity: Entity; strokeData: StrokeData; mirrorMode: string };
  };
  tools.samplePosition.set(0.3, 0.1, -1); tools.sampleQuaternion.identity(); tools.startStroke(command, 1, 1);
  const lead = tools.activeStroke!; lead.mirrorMode = "x";
  tools.samplePosition.set(0.6, 0.1, -1); tools.sampleActiveStroke(1.02, 1, true); tools.finalizeActiveStroke();
  const collect = () => (SketchLibrarySystem.prototype as unknown as { collectStrokeData(): StrokeData[] }).collectStrokeData.call({ world, queries: authoring.queries });
  const initial = collect(), authored = initial.filter(stroke => stroke.guid.startsWith("runtime-stroke-"));
  check(authored.length === 2 && authored.every(stroke => stroke.groupId === 0), "New symmetry strokes acquired explicit selection groups");
  const mirror = authored.find(stroke => !!(stroke.flags & StrokeFlags.IsGroupContinue))!;
  check(!!mirror, "Symmetry continuation flag missing");
  tools.undoLastStroke(); check(!collect().some(stroke => authored.some(a => a.guid === stroke.guid)), "Symmetry undo split its action");
  tools.redoLastStroke(); check(collect().length === 4, "Symmetry redo failed");
  authoring.applyRemoteVisibility([lead.strokeData.guid], false);
  const erasedLead = collect();
  check(erasedLead.length === 3 && !(erasedLead[2].flags & StrokeFlags.IsGroupContinue), "Surviving symmetry continuation joined preceding action");
  const saved = readTiltFile(writeTiltFile(createSketchDocument({ strokes: erasedLead })));
  check(saved.strokes[0].groupId === 0xf1234567 && saved.strokes[1].groupId === 0xf1234567 && saved.strokes[1].flags === StrokeFlags.IsGroupContinue && saved.strokes[2].groupId === 0 && saved.strokes[2].flags === 0, "File round trip changed native grouping");
  authoring.applyRemoteVisibility([lead.strokeData.guid], true);
  check(!!(collect().find(stroke => stroke.guid === mirror.guid)!.flags & StrokeFlags.IsGroupContinue), "Save adjustment mutated original continuation state");
  return { passed: true, importedTag: importedLead.getValue(BrushStroke, "groupId"), authoredSelectionTags: authored.map(stroke => stroke.groupId),
    savedFlagsAfterErasingLead: saved.strokes.map(stroke => stroke.flags), symmetryUndoRedo: true, originalFlagsRestored: true,
    scope: "Isolated production authoring/history/ECS and actual library collection method plus file round trip; no gallery UI, native Editor or physical XR" };
}
