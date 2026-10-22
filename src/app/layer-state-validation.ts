import { World, Mesh, BoxGeometry, MeshBasicMaterial } from "@iwsdk/core";
import { CanvasLayer, BrushStroke, BatchedBrushStroke, OpenBrushAppState } from "../components/core.js";
import { LayerCanvasSystem } from "../systems/layer-canvas-system.js";

export async function validateLayerState(container: HTMLDivElement) {
  const world = await World.create(container, { xr: false, render: { defaultLighting: false }, features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  // The application registers this through its batch system; this isolated
  // world still needs the schema for LayerCanvasSystem's hasComponent check.
  world.registerComponent(BatchedBrushStroke);
  world.registerSystem(LayerCanvasSystem);
  const appState = world.createTransformEntity().addComponent(OpenBrushAppState);
  world.createTransformEntity().addComponent(CanvasLayer, { layerIndex: 0 });
  world.createTransformEntity().addComponent(CanvasLayer, { layerIndex: 9 });
  const selection = world.createTransformEntity().addComponent(CanvasLayer, { layerIndex: 1, selectionCanvas: true });
  const frames = async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };
  await frames();
  const system = world.getSystem(LayerCanvasSystem)!;
  const rows = () => [...system.queries.layers.entities].filter(entity => !entity.getValue(CanvasLayer, "selectionCanvas"))
    .map(entity => ({ id: Number(entity.getValue(CanvasLayer, "layerIndex")), name: String(entity.getValue(CanvasLayer, "layerName")), visible: Boolean(entity.getValue(CanvasLayer, "visible")), locked: Boolean(entity.getValue(CanvasLayer, "locked")) })).sort((a, b) => a.id - b.id);
  system.setLayers([
    { id: 0, name: "Backdrop", visible: false, locked: false },
    { id: 1, name: "Ink", visible: true, locked: false },
    { id: 5, name: "Locked", visible: true, locked: true },
  ]);
  const hidden = world.createTransformEntity(new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshBasicMaterial()))
    .addComponent(BrushStroke, { guid: "hidden-layer-stroke", layerIndex: 0, visible: true, renderVisible: true });
  const shown = world.createTransformEntity(new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshBasicMaterial()))
    .addComponent(BrushStroke, { guid: "shown-layer-stroke", layerIndex: 1, visible: true, renderVisible: true });
  await frames();
  const loaded = rows();
  const activeLayer = Number(appState.getValue(OpenBrushAppState, "activeLayerIndex"));
  const visibility = { hiddenLogical: hidden.getValue(BrushStroke, "visible"), hiddenRendered: hidden.getValue(BrushStroke, "renderVisible"), hiddenObject: hidden.object3D!.visible, shownRendered: shown.getValue(BrushStroke, "renderVisible"), shownObject: shown.object3D!.visible };
  hidden.dispose(); shown.dispose();
  system.setLayers([{ id: 0, name: "Fresh", visible: true, locked: false }]);
  await frames();
  const reset = rows();
  const selectionSurvives = [...system.queries.layers.entities].includes(selection) && Boolean(selection.getValue(CanvasLayer, "selectionCanvas"));
  const passed = loaded.length === 3 && !loaded.some(layer => layer.id === 9) && activeLayer === 1 && visibility.hiddenLogical === true && visibility.hiddenRendered === false && visibility.hiddenObject === false && visibility.shownRendered === true && visibility.shownObject === true && reset.length === 1 && reset[0].name === "Fresh" && selectionSurvives;
  return { passed, loaded, activeLayer, visibility, reset, selectionSurvives, scope: "Isolated IWSDK layer component/visibility lifecycle; no native transforms, UI interaction, batched strokes or hardware XR" };
}
