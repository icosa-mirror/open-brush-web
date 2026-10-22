import { createSystem, Transform } from "@iwsdk/core";
import type { Entity } from "@iwsdk/core";

import {
  BatchedBrushStroke,
  BrushStroke,
  CanvasLayer,
  OpenBrushAppState,
  OpenBrushScenePose,
} from "../components/core.js";
import { resolveStrokeRenderVisibility } from "../brushes/stroke-batch-feature.js";
import { StrokeBatchRenderSystem } from "./stroke-batch-render-system.js";
import type { SketchLayer } from "../sketch/document.js";
import { readWebLayerTransform } from "../sketch/layer-transform.js";

export class LayerCanvasSystem extends createSystem({
  appState: { required: [OpenBrushAppState] },
  layers: { required: [CanvasLayer] },
  strokes: { required: [BrushStroke] },
  scenePoses: { required: [OpenBrushScenePose] },
}) {
  /** Restores document layer state; selection canvases belong to the tools. */
  setLayers(layers: readonly SketchLayer[]): void {
    if (!layers.length || layers.some(layer => !Number.isSafeInteger(layer.id) || layer.id < 0 || layer.id > 0x7fffffff) || new Set(layers.map(layer => layer.id)).size !== layers.length) {
      throw new Error("Sketch layers require unique nonnegative integer IDs.");
    }
    const poses = layers.map(layer => readWebLayerTransform(layer.transform));
    const scenePose = this.queries.scenePoses.entities.values().next().value as Entity | undefined;
    const parent = scenePose ?? this.world.sceneEntity;
    const existing = new Map([...this.queries.layers.entities]
      .filter(entity => !entity.getValue(CanvasLayer, "selectionCanvas"))
      .map(entity => [Number(entity.getValue(CanvasLayer, "layerIndex")), entity]));
    layers.forEach((layer, order) => {
      const entity = existing.get(layer.id) ?? this.world.createTransformEntity(undefined, parent).addComponent(CanvasLayer);
      if (entity.getValue(Transform, "parent") !== parent) entity.setValue(Transform, "parent", parent);
      existing.delete(layer.id);
      entity.setValue(CanvasLayer, "layerIndex", layer.id);
      entity.setValue(CanvasLayer, "order", order);
      entity.setValue(CanvasLayer, "layerName", layer.name);
      entity.setValue(CanvasLayer, "visible", layer.visible);
      entity.setValue(CanvasLayer, "locked", layer.locked);
      if (entity.object3D) {
        const pose = poses[order];
        entity.object3D.name = `OpenBrushLayer_${layer.id}`;
        entity.object3D.position.set(...(pose?.position ?? [0, 0, 0] as const));
        entity.object3D.quaternion.set(...(pose?.rotation ?? [0, 0, 0, 1] as const));
        entity.object3D.scale.setScalar(pose?.scale ?? 1);
      }
    });
    for (const entity of existing.values()) entity.dispose();
    const active = layers.find(layer => layer.visible && !layer.locked) ?? layers[0];
    this.getAppStateEntity()?.setValue(OpenBrushAppState, "activeLayerIndex", active.id);
  }

  update() {
    const appState = this.getAppStateEntity();
    if (!appState) {
      return;
    }

    const activeLayerIndex = this.resolveActiveLayerIndex(
      Number(appState.getValue(OpenBrushAppState, "activeLayerIndex")),
    );
    if (
      activeLayerIndex !==
      Number(appState.getValue(OpenBrushAppState, "activeLayerIndex"))
    ) {
      appState.setValue(OpenBrushAppState, "activeLayerIndex", activeLayerIndex);
    }

    for (const layer of this.queries.layers.entities) {
      const isActive =
        !layer.getValue(CanvasLayer, "selectionCanvas") &&
        Number(layer.getValue(CanvasLayer, "layerIndex")) === activeLayerIndex;
      layer.setValue(CanvasLayer, "active", isActive);
    }

    const batchRenderer = this.world.getSystem(StrokeBatchRenderSystem);
    let hasDeferredBatchVisibility = false;
    for (const stroke of this.queries.strokes.entities) {
      const layer = this.getLayerEntity(
        Number(stroke.getValue(BrushStroke, "layerIndex")),
      );
      const layerVisible = layer
        ? Boolean(layer.getValue(CanvasLayer, "visible"))
        : true;
      const strokeVisible = Boolean(stroke.getValue(BrushStroke, "visible"));
      const renderVisible = resolveStrokeRenderVisibility(
        strokeVisible,
        layerVisible,
      );
      if (
        Boolean(stroke.getValue(BrushStroke, "renderVisible")) === renderVisible
      ) {
        continue;
      }
      stroke.setValue(BrushStroke, "renderVisible", renderVisible);
      if (stroke.hasComponent(BatchedBrushStroke)) {
        const handled = batchRenderer?.setStrokeVisibleDeferred(
          String(stroke.getValue(BrushStroke, "guid")),
          renderVisible,
        );
        hasDeferredBatchVisibility = Boolean(handled) || hasDeferredBatchVisibility;
        if (!handled && stroke.object3D) {
          stroke.object3D.visible = renderVisible;
        }
      } else if (stroke.object3D) {
        stroke.object3D.visible = renderVisible;
      }
    }
    if (hasDeferredBatchVisibility) {
      batchRenderer?.flushDeferredVisibility();
    }
  }

  private resolveActiveLayerIndex(requestedLayerIndex: number): number {
    let firstPaintLayerIndex: number | undefined;
    let firstPaintLayerOrder = Number.MAX_SAFE_INTEGER;
    for (const layer of this.queries.layers.entities) {
      if (layer.getValue(CanvasLayer, "selectionCanvas")) {
        continue;
      }
      const layerIndex = Number(layer.getValue(CanvasLayer, "layerIndex"));
      const layerOrder = Number(layer.getValue(CanvasLayer, "order"));
      if (layerOrder < firstPaintLayerOrder) {
        firstPaintLayerIndex = layerIndex;
        firstPaintLayerOrder = layerOrder;
      }
      if (layerIndex === requestedLayerIndex) {
        return requestedLayerIndex;
      }
    }
    return firstPaintLayerIndex ?? requestedLayerIndex;
  }

  private getLayerEntity(layerIndex: number): Entity | undefined {
    for (const layer of this.queries.layers.entities) {
      if (
        !layer.getValue(CanvasLayer, "selectionCanvas") &&
        Number(layer.getValue(CanvasLayer, "layerIndex")) === layerIndex
      ) {
        return layer;
      }
    }
    return undefined;
  }

  private getAppStateEntity(): Entity | undefined {
    const next = this.queries.appState.entities.values().next();
    return next.done ? undefined : next.value;
  }
}
