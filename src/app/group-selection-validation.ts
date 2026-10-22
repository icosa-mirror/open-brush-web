import { World, type Entity } from "@iwsdk/core";
import { BrushStroke, OpenBrushAppState, OpenBrushScenePose, SelectionState, UiCommandHistoryState } from "../components/core.js";
import { LayerCanvasSystem } from "../systems/layer-canvas-system.js";
import { StrokeAuthoringSystem } from "../systems/stroke-authoring-system.js";
import { StrokeBatchRenderSystem } from "../systems/stroke-batch-render-system.js";
import { SelectionSystem } from "../systems/selection-system.js";
import { PanelSystem } from "../systems/panel-system.js";
import { openBrushShaderLibrary } from "../brushes/brush-shader-library.js";
import { openBrushInventory } from "../brushes/brush-catalog.js";
import { createEmptyStrokeData, type Vec3 } from "../types.js";

const LIGHT = "2241cd32-8ba2-48a5-9ee7-2caef7e9ed62";
function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }

export async function validateGroupSelection(container: HTMLDivElement) {
  const world = await World.create(container, { xr: false, render: { defaultLighting: false }, features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  world.registerSystem(LayerCanvasSystem).registerSystem(StrokeBatchRenderSystem).registerSystem(StrokeAuthoringSystem).registerSystem(SelectionSystem).registerSystem(PanelSystem);
  world.createTransformEntity().addComponent(OpenBrushAppState, { mode: "intro", activeLayerIndex: 0 });
  world.createTransformEntity().addComponent(OpenBrushScenePose);
  const selection = world.createTransformEntity().addComponent(SelectionState);
  world.createTransformEntity().addComponent(UiCommandHistoryState);
  const frames = async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };
  await frames();
  world.getSystem(LayerCanvasSystem)!.setLayers([{ id: 0, name: "Active", visible: true, locked: false }, { id: 4, name: "Hidden", visible: false, locked: true }]);
  await openBrushShaderLibrary.load(openBrushInventory.find(entry => entry.guid === LIGHT)!);
  const authoring = world.getSystem(StrokeAuthoringSystem)!;
  const spawn = (guid: string, groupId: number, layerIndex: number, visible = true) => authoring.spawnStrokeFromData(createEmptyStrokeData({ guid, brushGuid: LIGHT, groupId, layerIndex, brushSize: 0.03, seed: 7,
    controlPoints: [[0, 0, -1], [0.1, 0.02, -1], [0.2, 0, -1]].map(position => ({ position: position as Vec3, orientation: [0, 0, 0, 1], pressure: 1, timestampMs: 0 })) }), visible);
  const a = spawn("group-active", 0xf1234567, 0), b = spawn("group-hidden", 0xf1234567, 4);
  const erased = spawn("group-erased", 0xf1234567, 0, false), other = spawn("other-group", 0xf1234568, 4);
  const panels = world.getSystem(PanelSystem)! as unknown as { selectLastStrokeOnActiveLayer(): void; clearSelection(): void; undoUiCommand(): void; redoUiCommand(): void };
  const selected = (entity: Entity) => !!entity.getValue(BrushStroke, "selected");
  panels.selectLastStrokeOnActiveLayer(); await frames();
  check(selected(a) && selected(b) && !selected(erased) && !selected(other), "Explicit group expansion differs from native active membership");
  check(selection.getValue(SelectionState, "selectedStrokeCount") === 2 && selection.getValue(SelectionState, "activeSelectionLayerIndex") === -1, "Cross-layer group summary is incorrect");
  panels.undoUiCommand(); await frames(); check(!selected(a) && !selected(b), "Group selection undo split members");
  panels.redoUiCommand(); await frames(); check(selected(a) && selected(b), "Group selection redo split members");
  panels.clearSelection(); await frames(); check(!selected(a) && !selected(b), "Clear selection failed");
  panels.undoUiCommand(); await frames(); check(selected(a) && selected(b), "Clear selection undo lost group");
  const ungrouped = spawn("ungrouped", 0, 0);
  panels.selectLastStrokeOnActiveLayer(); await frames();
  check(selected(ungrouped) && !selected(a) && !selected(b) && !selected(other), "Ungrouped selection expanded to unrelated strokes");
  return { passed: true, explicitTag: 0xf1234567, groupMembersSelected: 2, erasedMemberExcluded: true, otherGroupExcluded: true,
    groupSelectionUndoRedo: true, clearUndoRestoresGroup: true, ungroupedSelectsAlone: true,
    scope: "Actual PanelSystem commands/history and production selection/batch systems without panel UI entities; state membership only, no native pixels or physical XR" };
}
