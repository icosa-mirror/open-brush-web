import { TransformParentCompatibilitySystem } from "../systems/transform-parent-compatibility-system.js";
import { World, Transform, Group, Vector3, Mesh, BoxGeometry, MeshBasicMaterial, type Entity } from "@iwsdk/core";
import { BrushStroke, CanvasLayer, OpenBrushAppState, OpenBrushScenePose, SelectionState, SelectionWidget, UiCommandHistoryState } from "../components/core.js";
import { LayerCanvasSystem } from "../systems/layer-canvas-system.js";
import { StrokeAuthoringSystem } from "../systems/stroke-authoring-system.js";
import { StrokeBatchRenderSystem } from "../systems/stroke-batch-render-system.js";
import { SelectionSystem, SelectionLayerFrame } from "../systems/selection-system.js";
import { PanelSystem } from "../systems/panel-system.js";
import { SketchLibrarySystem } from "../systems/sketch-library-system.js";
import { openBrushShaderLibrary } from "../brushes/brush-shader-library.js";
import { openBrushInventory } from "../brushes/brush-catalog.js";
import { createEmptyStrokeData, type StrokeData, type Vec3 } from "../types.js";

const LIGHT = "2241cd32-8ba2-48a5-9ee7-2caef7e9ed62";
function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }

export async function validateGroupSelection(container: HTMLDivElement) {
  const world = await World.create(container, { xr: false, render: { defaultLighting: false }, features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  world.registerSystem(TransformParentCompatibilitySystem).registerSystem(LayerCanvasSystem).registerSystem(StrokeBatchRenderSystem).registerSystem(StrokeAuthoringSystem).registerSystem(SelectionSystem).registerSystem(PanelSystem);
  world.createTransformEntity().addComponent(OpenBrushAppState, { mode: "intro", activeLayerIndex: 0 });
  const scene = world.createTransformEntity().addComponent(OpenBrushScenePose);
  const canvas = world.createTransformEntity(undefined, scene).addComponent(CanvasLayer, { selectionCanvas: true, layerIndex: 1 });
  const widget = world.createTransformEntity(new Group(), canvas).addComponent(SelectionWidget);
  const selection = world.createTransformEntity().addComponent(SelectionState);
  world.createTransformEntity().addComponent(UiCommandHistoryState);
  const frames = async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };
  await frames();
  world.getSystem(LayerCanvasSystem)!.setLayers([{ id: 0, name: "Active", visible: true, locked: false }, { id: 4, name: "Hidden", visible: false, locked: true,
    transform: { position: [1, 2, -3], rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2], scale: 2 } }]);
  await openBrushShaderLibrary.load(openBrushInventory.find(entry => entry.guid === LIGHT)!);
  const authoring = world.getSystem(StrokeAuthoringSystem)!;
  const spawn = (guid: string, groupId: number, layerIndex: number, visible = true) => authoring.spawnStrokeFromData(createEmptyStrokeData({ guid, brushGuid: LIGHT, groupId, layerIndex, brushSize: 0.03, seed: 7,
    controlPoints: [[0, 0, -1], [0.1, 0.02, -1], [0.2, 0, -1]].map(position => ({ position: position as Vec3, orientation: [0, 0, 0, 1], pressure: 1, timestampMs: 0 })) }), visible);
  const a = spawn("group-active", 0xf1234567, 0), b = spawn("group-hidden", 0xf1234567, 4);
  const erased = spawn("group-erased", 0xf1234567, 0, false), other = spawn("other-group", 0xf1234568, 4);
  const panels = world.getSystem(PanelSystem)! as unknown as { selectLastStrokeOnActiveLayer(): void; clearSelection(): void; undoUiCommand(): void; redoUiCommand(): void };
  const selected = (entity: Entity) => !!entity.getValue(BrushStroke, "selected");
  await frames();
  const origin = (entity: Entity) => entity.object3D!.localToWorld(new Vector3());
  const beforeA = origin(a), beforeB = origin(b);
  const collector = () => (SketchLibrarySystem.prototype as unknown as { collectStrokeData(): StrokeData[] }).collectStrokeData.call({ world, queries: authoring.queries });
  panels.selectLastStrokeOnActiveLayer(); await frames();
  check(selected(a) && selected(b) && !selected(erased) && !selected(other), "Explicit group expansion differs from native active membership");
  check(selection.getValue(SelectionState, "selectedStrokeCount") === 2 && selection.getValue(SelectionState, "activeSelectionLayerIndex") === -1, "Cross-layer group summary is incorrect");
  check(a.object3D!.parent?.parent === canvas.object3D && b.object3D!.parent?.parent === canvas.object3D, "Selected stroke frames are outside the selection canvas");
  check(origin(a).distanceTo(beforeA) < 1e-5 && origin(b).distanceTo(beforeB) < 1e-5, "Selection parent migration changed world pose");
  check(b.getValue(BrushStroke, "renderVisible") === true && b.object3D!.visible, "Hidden-layer selected stroke did not become visible");
  const framesAtSelection = world.getSystem(SelectionSystem)!.queries.frames.entities.size;
  check(framesAtSelection === 2, "Selection created duplicate/missing layer frames");
  widget.object3D!.position.add(new Vector3(0.1, 0.2, 0.3)); await frames();
  const delta = new Vector3(0.1, 0.2, 0.3);
  check(origin(a).sub(beforeA).distanceTo(delta) < 1e-5 && origin(b).sub(beforeB).distanceTo(delta) < 1e-5, "Moved selection frames produced unequal world displacement");
  const pending = collector();
  const pointA = pending.find(stroke => stroke.guid === "group-active")!.controlPoints[0].position;
  const pointB = pending.find(stroke => stroke.guid === "group-hidden")!.controlPoints[0].position;
  check(new Vector3(...pointA).distanceTo(new Vector3(0.1, 0.2, -0.7)) < 1e-5 && new Vector3(...pointB).distanceTo(new Vector3(-0.15, 0.1, -0.95)) < 1e-5, "Pending save translation lost the original layer basis");
  panels.undoUiCommand(); await frames(); check(!selected(a) && !selected(b), "Group selection undo split members");
  check(!b.getValue(BrushStroke, "renderVisible") && !b.object3D!.visible && world.getSystem(SelectionSystem)!.queries.frames.entities.size === 0, "Deselect did not restore hidden visibility/clean up frames");
  const settled = collector();
  check(settled.every(stroke => pending.find(row => row.guid === stroke.guid)?.controlPoints.every((point, i) => new Vector3(...point.position).distanceTo(new Vector3(...stroke.controlPoints[i].position)) < 1e-5)), "Reinsertion changed the pending save result");
  panels.redoUiCommand(); await frames(); check(selected(a) && selected(b), "Group selection redo split members");
  panels.clearSelection(); await frames(); check(!selected(a) && !selected(b), "Clear selection failed");
  panels.undoUiCommand(); await frames(); check(selected(a) && selected(b), "Clear selection undo lost group");
  const ungrouped = spawn("ungrouped", 0, 0);
  panels.selectLastStrokeOnActiveLayer(); await frames();
  check(selected(ungrouped) && !selected(a) && !selected(b) && !selected(other), "Ungrouped selection expanded to unrelated strokes");
  const hidden = [...world.getSystem(LayerCanvasSystem)!.queries.layers.entities].find(layer => !layer.getValue(CanvasLayer, "selectionCanvas") && layer.getValue(CanvasLayer, "layerIndex") === 4)!;
  const fallback = world.createTransformEntity(new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshBasicMaterial()), hidden).addComponent(BrushStroke, { guid: "private-probe", layerIndex: 4, finalized: true, visible: true });
  await frames(); const fallbackBefore = origin(fallback);
  fallback.setValue(BrushStroke, "selected", true); await frames();
  check(fallback.object3D!.parent?.parent === canvas.object3D && fallback.object3D!.visible && origin(fallback).distanceTo(fallbackBefore) < 1e-5, "Private fallback selection did not preserve pose/visibility");
  fallback.setValue(BrushStroke, "selected", false); await frames();
  const declaredParent = fallback.getValue(Transform, "parent") as Entity | undefined;
  check(fallback.object3D!.parent === hidden.object3D && !fallback.object3D!.visible, `Private fallback did not return to hidden layer: parent=${fallback.object3D!.parent?.name}, declared=${declaredParent?.object3D?.name}, parentHasFrame=${declaredParent?.hasComponent(SelectionLayerFrame)}, home=${hidden.object3D!.name}, objectVisible=${fallback.object3D!.visible}, renderVisible=${fallback.getValue(BrushStroke, "renderVisible")}, selected=${selected(fallback)}, live=${fallback.hasComponent(BrushStroke)}`);
  for (let cycle = 0; cycle < 10; cycle++) {
    fallback.setValue(BrushStroke, "selected", true); await frames();
    check(fallback.object3D!.parent?.parent === canvas.object3D && fallback.object3D!.visible, "Repeated selection did not enter its canvas");
    canvas.setValue(CanvasLayer, "visible", false); await frames();
    check(!fallback.object3D!.visible, "Selected private mesh ignored selection canvas visibility");
    canvas.setValue(CanvasLayer, "visible", true); await frames();
    check(fallback.object3D!.visible, "Selected private mesh did not restore selection canvas visibility");
    fallback.setValue(BrushStroke, "selected", false); await frames();
    check(fallback.getValue(Transform, "parent") === hidden && !fallback.object3D!.visible && origin(fallback).distanceTo(fallbackBefore) < 1e-5, "Repeated deselection lost home parent, pose or visibility");
  }
  panels.clearSelection(); await frames();
  check(world.getSystem(SelectionSystem)!.queries.frames.entities.size === 0, "Selection frames leaked after repeated selection/clear");
  return { passed: true, explicitTag: 0xf1234567, groupMembersSelected: 2, erasedMemberExcluded: true, otherGroupExcluded: true,
    groupSelectionUndoRedo: true, clearUndoRestoresGroup: true, ungroupedSelectsAlone: true,
    selectionFrames: framesAtSelection, worldPosePreserved: true, hiddenSelectionVisible: true, worldTranslation: delta.toArray(), pendingPoints: [pointA, pointB], reinsertionPreservesSave: true, unusedFramesCleaned: true, privateFallbackParenting: true, repeatCycles: 10, selectionCanvasVisibility: true,
    scope: "Actual production commands/history, selection canvas, posed layers, batch/private mesh and pending-save states; no panel clicks, native pixels or physical XR" };
}
