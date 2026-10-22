import { World, Group, Vector3, Quaternion, type Entity } from "@iwsdk/core";
import { CanvasLayer, BrushStroke, BrushSettings, InputCommandState, OpenBrushAppState, OpenBrushScenePose, OpenBrushTipAnchor, SelectionState, SelectionWidget, StrokeBatchMesh } from "../components/core.js";
import { LayerCanvasSystem } from "../systems/layer-canvas-system.js";
import { StrokeAuthoringSystem } from "../systems/stroke-authoring-system.js";
import { StrokeBatchRenderSystem } from "../systems/stroke-batch-render-system.js";
import { SelectionSystem } from "../systems/selection-system.js";
import { openBrushShaderLibrary } from "../brushes/brush-shader-library.js";
import { openBrushInventory } from "../brushes/brush-catalog.js";
import { createEmptyStrokeData, type StrokeData, type Vec3 } from "../types.js";
import { findPaintLayer } from "../strokes/layer-space.js";
import { createSketchDocument } from "../sketch/document.js";
import { readTiltFile, writeTiltFile } from "../sketch/tilt-file.js";

const LIGHT = "2241cd32-8ba2-48a5-9ee7-2caef7e9ed62";
function close(actual: readonly number[], expected: readonly number[], tolerance = 1e-5) { return actual.length === expected.length && actual.every((value, index) => Math.abs(value - expected[index]) < tolerance); }
function check(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

export async function validateLayerTransforms(container: HTMLDivElement) {
  const observations: Record<string, unknown> = { passed: false, stage: "create-world" };
  (window as unknown as { layerRuntimeProgress: Record<string, unknown> }).layerRuntimeProgress = observations;
  const world = await World.create(container, { xr: false, render: { defaultLighting: false }, features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  world.registerSystem(LayerCanvasSystem).registerSystem(StrokeBatchRenderSystem).registerSystem(StrokeAuthoringSystem).registerSystem(SelectionSystem);
  const state = world.createTransformEntity().addComponent(OpenBrushAppState, { mode: "intro" });
  const selectionState = world.createTransformEntity().addComponent(SelectionState);
  const scene = world.createTransformEntity().addComponent(OpenBrushScenePose);
  scene.object3D!.position.set(3, -2, 1); scene.object3D!.rotation.z = Math.PI / 2; scene.object3D!.scale.setScalar(1.5);
  const selectionCanvas = world.createTransformEntity(undefined, scene).addComponent(CanvasLayer, { layerIndex: 1, selectionCanvas: true });
  const widget = world.createTransformEntity(new Group(), selectionCanvas).addComponent(SelectionWidget);
  const frames = async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };
  await frames();
  const layers = world.getSystem(LayerCanvasSystem)!;
  layers.setLayers([
    { id: 0, name: "Base", visible: true, locked: false },
    { id: 4, name: "Rotated", visible: true, locked: false, transform: { position: [1, 2, -3], rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2], scale: 2 } },
    { id: 5, name: "Small", visible: true, locked: false, transform: { position: [-2, 0, 1], rotation: [0, 0, 0, 1], scale: 0.5 } },
  ]);
  state.setValue(OpenBrushAppState, "activeLayerIndex", 4);
  await frames();
  const layer = findPaintLayer(layers.queries.layers.entities, 4)!;
  const layer5 = findPaintLayer(layers.queries.layers.entities, 5)!;
  check(layer.object3D!.parent === scene.object3D, "Layer must be under scene pose");
  const probeWorld = layer.object3D!.localToWorld(new Vector3(0.1, 0.2, 0.3));
  observations.composedWorldPoint = probeWorld.toArray();
  check(close(probeWorld.toArray(), [-0.6, 0.4, -3.8]), "Composed layer/world pose differs from independent expected coordinates");
  const rawPose = [[10, 20, 30], [0, -0.70710677, 0, 0.70710677], 2];
  const object = layer.object3D!;
  const roundtrip = readTiltFile(writeTiltFile(createSketchDocument({
    layers: [{ id: 4, name: "Rotated", visible: true, locked: false, transform: { position: object.position.toArray(), rotation: object.quaternion.toArray(), scale: object.scale.x } }],
    tiltArchive: { metadata: { Layers: [{ Name: "Rotated", Visible: true, Transform: rawPose }], OpenBrushIwSdk: { nativeLayerIds: [4] } }, entries: [] },
  })));
  const preserved = (roundtrip.tiltArchive!.metadata.Layers as Array<{ Transform: unknown }>)[0].Transform;
  observations.nativePoseSurvivesRuntimeFloat32 = JSON.stringify(preserved) === JSON.stringify(rawPose);
  check(observations.nativePoseSurvivesRuntimeFloat32 === true, "Runtime Float32 fields unnecessarily rewrote unchanged native pose metadata");
  observations.stage = "spawn-and-batch";
  await openBrushShaderLibrary.load(openBrushInventory.find(entry => entry.guid === LIGHT)!);
  const authoring = world.getSystem(StrokeAuthoringSystem)!;
  const batches = world.getSystem(StrokeBatchRenderSystem)!;
  const makeStroke = (guid: string, layerIndex: number) => createEmptyStrokeData({ guid, brushGuid: LIGHT, layerIndex, brushSize: 0.03, seed: 5,
    controlPoints: [[0, 0, 0], [0.1, 0.02, 0], [0.2, -0.01, 0], [0.3, 0, 0.03]].map(position => ({ position: position as Vec3, orientation: [0, 0, 0, 1], pressure: 1, timestampMs: 0 })) });
  const a = authoring.spawnStrokeFromData(makeStroke("posed-a", 4), true);
  const b = authoring.spawnStrokeFromData(makeStroke("posed-b", 5), true);
  await frames();
  const targets = [...(batches as unknown as { targets: Map<unknown, { entity: Entity }> }).targets.values()];
  const target = targets.find(target => Number(target.entity.getValue(StrokeBatchMesh, "layerIndex")) === 4);
  observations.batchCount = targets.length;
  check(a.object3D!.parent === layer.object3D && b.object3D!.parent === layer5.object3D, "Private stroke parents do not match their layers");
  check(!!target && target.entity.object3D!.parent === layer.object3D, "Batch mesh parent does not match layer");
  const surface = layer.object3D!.localToWorld(new Vector3(0.1, 0.02, 0));
  const hitBefore = batches.strokeIntersectsSphere("posed-a", surface.toArray() as Vec3, 0.15);
  check(hitBefore === true, "Posed batch world-space hit test missed");
  const tools = authoring as unknown as {
    writeCanvasToolCenter(target: Vec3, worldCenter: Vec3): { center: Vec3; scale: number };
    readPickedStrokeSnapshot(entity: Entity): { brushSize: number };
    samplePosition: Vector3; sampleQuaternion: Quaternion;
    startStroke(command: Entity, time: number, pressure: number): void;
    sampleActiveStroke(time: number, pressure: number, force: boolean): void;
    finalizeActiveStroke(): void; undoLastStroke(): void; redoLastStroke(): void;
    ensurePreviewTrail(guid: string): { entity: Entity; strokeData: StrokeData; poseScale: number };
    activeStroke?: { entity: Entity; strokeData: StrokeData; poseScale: number };
  };
  const center = tools.writeCanvasToolCenter([0, 0, 0], probeWorld.toArray() as Vec3);
  observations.toolCenter = { center: [...center.center], scale: center.scale };
  check(close(center.center, [0.1, 0.2, 0.3]) && Math.abs(center.scale - 3) < 1e-5, "Tool broadphase uses wrong layer space/scale");
  check(Math.abs(tools.readPickedStrokeSnapshot(a).brushSize - 0.09) < 1e-5, "Picker size omits layer/world scale");
  world.createTransformEntity().addComponent(BrushSettings, { brushGuid: LIGHT, size: 0.06 });
  const preview = tools.ensurePreviewTrail(LIGHT);
  await frames();
  check(preview.entity.object3D!.parent === layer.object3D, "Preview creation uses wrong layer parent");
  observations.stage = "authoring";
  const command = world.createTransformEntity().addComponent(InputCommandState);
  tools.samplePosition.copy(probeWorld); layer.object3D!.getWorldQuaternion(tools.sampleQuaternion);
  tools.startStroke(command, 1, 0.7);
  const created = tools.activeStroke!;
  observations.authored = { position: [...created.strokeData.controlPoints[0].position], orientation: [...created.strokeData.controlPoints[0].orientation], brushSize: created.strokeData.brushSize, poseScale: created.poseScale };
  check(close(created.strokeData.controlPoints[0].position, [0.1, 0.2, 0.3]) && close(created.strokeData.controlPoints[0].orientation, [0, 0, 0, 1]) && Math.abs(created.strokeData.brushSize - 0.02) < 1e-5, "Authoring did not remove full layer/world pose");
  tools.samplePosition.copy(layer.object3D!.localToWorld(new Vector3(0.3, 0.2, 0.3)));
  tools.sampleActiveStroke(1.02, 0.7, true); tools.finalizeActiveStroke();
  tools.undoLastStroke(); check(created.entity.getValue(BrushStroke, "visible") === false, "Posed stroke undo failed");
  tools.redoLastStroke(); check(created.entity.getValue(BrushStroke, "visible") === true, "Posed stroke redo failed");
  observations.stage = "selection";
  const beforeA = a.object3D!.localToWorld(new Vector3()), beforeB = b.object3D!.localToWorld(new Vector3());
  a.setValue(BrushStroke, "selected", true); b.setValue(BrushStroke, "selected", true);
  selectionState.setValue(SelectionState, "selectionRevision", 1);
  await frames();
  const expectedMin = [Infinity, Infinity, Infinity], expectedMax = [-Infinity, -Infinity, -Infinity];
  for (const entity of [a, b]) {
    const min = entity.getVectorView(BrushStroke, "minBounds"), max = entity.getVectorView(BrushStroke, "maxBounds");
    for (let corner = 0; corner < 8; corner++) {
      const point = new Vector3(corner & 1 ? max[0] : min[0], corner & 2 ? max[1] : min[1], corner & 4 ? max[2] : min[2]);
      entity.object3D!.localToWorld(point); selectionCanvas.object3D!.worldToLocal(point);
      point.toArray().forEach((value, index) => { expectedMin[index] = Math.min(expectedMin[index], value); expectedMax[index] = Math.max(expectedMax[index], value); });
    }
  }
  const expectedCenter = expectedMin.map((value, index) => (value + expectedMax[index]) / 2);
  observations.selectionCenter = widget.object3D!.position.toArray();
  check(close(widget.object3D!.position.toArray(), expectedCenter), "Selection bounds are not in widget parent space");
  widget.object3D!.position.add(new Vector3(0.2, -0.1, 0.3));
  await frames();
  const deltaA = a.object3D!.localToWorld(new Vector3()).sub(beforeA), deltaB = b.object3D!.localToWorld(new Vector3()).sub(beforeB);
  observations.selectionWorldDeltas = [deltaA.toArray(), deltaB.toArray()];
  check(close(deltaA.toArray(), [0.15, 0.3, 0.45]) && close(deltaB.toArray(), [0.15, 0.3, 0.45]), "Multi-layer selection moves have different world displacement");
  a.setValue(BrushStroke, "selected", false); b.setValue(BrushStroke, "selected", false);
  selectionState.setValue(SelectionState, "selectionRevision", 2);
  await frames();
  const savedA = batches.getStrokeDataSnapshot(a)!;
  observations.savedLocalPoint = savedA.controlPoints[0].position;
  check(close(savedA.controlPoints[0].position, [-0.15, -0.05, 0.1]), "Batch reinsertion/export offset is not layer-local");
  const afterHit = batches.strokeIntersectsSphere("posed-a", surface.clone().add(new Vector3(0.15, 0.3, 0.45)).toArray() as Vec3, 0.15);
  check(afterHit === true, "Reinserted posed batch missed translated world hit");
  observations.stage = "preview-layer-switch";
  const anchor = world.createTransformEntity(new Group()).addComponent(OpenBrushTipAnchor, { hand: "right" });
  anchor.object3D!.position.copy(layer5.object3D!.localToWorld(new Vector3(0.4, 0.5, 0.6)));
  layer5.object3D!.getWorldQuaternion(anchor.object3D!.quaternion);
  command.setValue(InputCommandState, "source", "xr-right");
  command.setValue(InputCommandState, "primaryHand", "right");
  state.setValue(OpenBrushAppState, "activeLayerIndex", 5);
  state.setValue(OpenBrushAppState, "mode", "ready");
  await frames();
  const switchedPreview = tools.ensurePreviewTrail(LIGHT);
  observations.previewAfterLayerSwitch = { parentMatches: switchedPreview.entity.object3D!.parent === layer5.object3D, position: switchedPreview.strokeData.controlPoints[0]?.position, brushSize: switchedPreview.strokeData.brushSize, poseScale: switchedPreview.poseScale };
  check(switchedPreview.entity.object3D!.parent === layer5.object3D && close(switchedPreview.strokeData.controlPoints[0]?.position ?? [], [0.4, 0.5, 0.6]) && Math.abs(switchedPreview.poseScale - 0.75) < 1e-5, "Preview did not follow changed active-layer pose");
  state.setValue(OpenBrushAppState, "mode", "intro");
  observations.passed = true; observations.stage = "complete";
  observations.scope = "Isolated IWSDK production systems with deterministic layer poses and synthetic tool input; no native pixels, actual controller gestures, connected collaboration or physical XR";
  return observations;
}
