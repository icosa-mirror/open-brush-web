import { createSystem, createComponent, Types, Transform, Vector3, Box3, Matrix3, Matrix4, type Object3D } from "@iwsdk/core";
import type { Entity } from "@iwsdk/core";

import {
  BatchedBrushStroke,
  BrushStroke,
  CanvasLayer,
  ExtractedBatchedBrushStroke,
  SelectionState,
  SelectionWidget,
} from "../components/core.js";
import {
  resolveStrokeBatchExtractionTransition,
} from "../brushes/stroke-batch-feature.js";
import { StrokeBatchRenderSystem } from "./stroke-batch-render-system.js";
import { findPaintLayer, writeParentSpaceTranslation } from "../strokes/layer-space.js";

// One frame per selected paint layer preserves the generator's layer-local
// basis under the selection canvas, without rewriting every stroke's points.
export const SelectionLayerFrame = createComponent("SelectionLayerFrame", {
  layerIndex: { type: Types.Int32, default: 0 },
});

export class SelectionSystem extends createSystem({
  selectionState: { required: [SelectionState] },
  strokes: { required: [BrushStroke] },
  widgets: { required: [SelectionWidget] },
  layers: { required: [CanvasLayer] },
  frames: { required: [SelectionLayerFrame] },
}) {
  private widgetPosition!: Vector3;
  private selectionCenter!: Vector3;
  private movementDelta!: Vector3;
  private readonly selectionBounds = new Box3();
  private readonly strokeBounds = new Box3();
  private readonly parentInverse = new Matrix4();
  private readonly spaceMatrix = new Matrix4();
  private readonly translationMatrix = new Matrix4();
  private readonly translationLinear = new Matrix3();
  private readonly localDelta = new Vector3();
  private readonly selectedLayers = new Set<number>();
  private lastSelectionRevision = -1;
  private readonly summarizeWithBatches = () =>
    this.summarizeSelection(this.world.getSystem(StrokeBatchRenderSystem));

  init() {
    this.widgetPosition = new Vector3();
    this.selectionCenter = new Vector3();
    this.movementDelta = new Vector3();
  }

  update() {
    const selectionState = this.getSelectionStateEntity();
    if (!selectionState) {
      return;
    }

    const batches = this.world.getSystem(StrokeBatchRenderSystem);
    const summary = batches
      ? batches.withDeferredUploads(this.summarizeWithBatches)
      : this.summarizeSelection(undefined);
    this.setNumberIfChanged(
      selectionState,
      "selectedStrokeCount",
      summary.selectedStrokeCount,
    );
    this.setNumberIfChanged(
      selectionState,
      "activeSelectionLayerIndex",
      summary.activeSelectionLayerIndex,
    );
    this.setNumberIfChanged(
      selectionState,
      "lastSelectedStrokeCommandIndex",
      summary.lastSelectedStrokeCommandIndex,
    );
    this.updateSelectionWidget(selectionState, summary.selectedStrokeCount);
  }

  private summarizeSelection(
    batchRenderer: StrokeBatchRenderSystem | undefined,
  ): {
    selectedStrokeCount: number;
    activeSelectionLayerIndex: number;
    lastSelectedStrokeCommandIndex: number;
  } {
    let selectedStrokeCount = 0;
    let activeSelectionLayerIndex = -1;
    let lastSelectedStrokeCommandIndex = 0;
    let hasMixedLayerSelection = false;
    this.selectedLayers.clear();

    for (const stroke of this.queries.strokes.entities) {
      const selected = Boolean(stroke.getValue(BrushStroke, "selected"));
      if (selected) this.selectedLayers.add(Number(stroke.getValue(BrushStroke, "layerIndex")));
      this.syncSelectionParent(stroke, selected);
      if (batchRenderer) {
        const transition = resolveStrokeBatchExtractionTransition(
          selected,
          stroke.hasComponent(BatchedBrushStroke),
          stroke.hasComponent(ExtractedBatchedBrushStroke),
        );
        if (transition === "begin") {
          batchRenderer.beginStrokeExtraction(stroke);
        } else if (transition === "finish") {
          batchRenderer.finishStrokeExtraction(stroke);
        }
      }
      if (!selected) {
        continue;
      }
      selectedStrokeCount += 1;
      const layerIndex = Number(stroke.getValue(BrushStroke, "layerIndex"));
      const commandIndex = Number(stroke.getValue(BrushStroke, "commandIndex"));
      lastSelectedStrokeCommandIndex = Math.max(
        lastSelectedStrokeCommandIndex,
        commandIndex,
      );
      if (selectedStrokeCount === 1) {
        activeSelectionLayerIndex = layerIndex;
      } else if (activeSelectionLayerIndex !== layerIndex) {
        hasMixedLayerSelection = true;
        activeSelectionLayerIndex = -1;
      }
    }

    this.prepareSelectionFrames();
    for (const frame of this.queries.frames.entities) {
      // Transform parenting settles on the following ECS frame. Wait until
      // children have actually left before destroying their old empty frame.
      if (!this.selectedLayers.has(Number(frame.getValue(SelectionLayerFrame, "layerIndex"))) && !frame.object3D?.children.length) frame.destroy();
    }

    return {
      selectedStrokeCount,
      activeSelectionLayerIndex: hasMixedLayerSelection
        ? -1
        : activeSelectionLayerIndex,
      lastSelectedStrokeCommandIndex,
    };
  }

  private findSelectionFrame(id: number): Entity | undefined {
    for (const frame of this.queries.frames.entities) {
      if (Number(frame.getValue(SelectionLayerFrame, "layerIndex")) === id) return frame;
    }
    return undefined;
  }

  private prepareSelectionFrames(): void {
    if (!this.selectedLayers.size) return;
    let canvas: Entity | undefined;
    for (const layer of this.queries.layers.entities) {
      if (layer.getValue(CanvasLayer, "selectionCanvas")) { canvas = layer; break; }
    }
    if (!canvas?.object3D) return;
    for (const id of this.selectedLayers) {
      if (this.findSelectionFrame(id)) continue;
      const home = findPaintLayer(this.queries.layers.entities, id);
      if (!home?.object3D) continue;
      canvas.object3D.updateWorldMatrix(true, false); home.object3D.updateWorldMatrix(true, false);
      this.spaceMatrix.copy(canvas.object3D.matrixWorld).invert().multiply(home.object3D.matrixWorld);
      const frame = this.world.createTransformEntity(undefined, canvas).addComponent(SelectionLayerFrame, { layerIndex: id });
      frame.object3D!.name = `OpenBrushSelectionLayer_${id}`;
      this.spaceMatrix.decompose(frame.object3D!.position, frame.object3D!.quaternion, frame.object3D!.scale);
    }
  }

  private syncSelectionParent(stroke: Entity, selected: boolean): void {
    const parent = stroke.getValue(Transform, "parent") as Entity | null;
    if (selected) {
      if (parent?.hasComponent(SelectionLayerFrame)) return;
      const home = findPaintLayer(this.queries.layers.entities, Number(stroke.getValue(BrushStroke, "layerIndex")));
      const frame = this.findSelectionFrame(Number(stroke.getValue(BrushStroke, "layerIndex")));
      // Synthetic/foreign entities can use another basis. Only migrate known
      // layer-local strokes, whose local TRS remains unchanged in this frame.
      if (frame && home && parent === home) stroke.setValue(Transform, "parent", frame);
    } else if (parent?.hasComponent(SelectionLayerFrame)) {
      const home = findPaintLayer(this.queries.layers.entities, Number(stroke.getValue(BrushStroke, "layerIndex")));
      if (home) stroke.setValue(Transform, "parent", home);
    }
  }

  private setNumberIfChanged(
    entity: Entity,
    field:
      | "selectedStrokeCount"
      | "activeSelectionLayerIndex"
      | "lastSelectedStrokeCommandIndex",
    value: number,
  ): void {
    if (Number(entity.getValue(SelectionState, field)) !== value) {
      entity.setValue(SelectionState, field, value);
    }
  }

  private updateSelectionWidget(
    selectionState: Entity,
    selectedStrokeCount: number,
  ): void {
    const widget = this.getSelectionWidgetEntity();
    if (!widget || !widget.object3D) {
      return;
    }

    if (selectedStrokeCount === 0) {
      this.setWidgetActive(widget, false);
      this.setWidgetInitialized(widget, false);
      this.setWidgetSelectedStrokeCount(widget, 0);
      widget.object3D.visible = false;
      this.lastSelectionRevision = Number(
        selectionState.getValue(SelectionState, "selectionRevision"),
      );
      return;
    }

    const selectionRevision = Number(
      selectionState.getValue(SelectionState, "selectionRevision"),
    );
    const initialized = Boolean(
      widget.getValue(SelectionWidget, "initialized"),
    );

    if (!initialized || selectionRevision !== this.lastSelectionRevision) {
      if (this.computeSelectedStrokeCenter(this.selectionCenter, widget.object3D.parent)) {
        widget.object3D.position.copy(this.selectionCenter);
        this.writeWidgetLastPosition(widget, this.selectionCenter);
      }
      this.setWidgetInitialized(widget, true);
      this.setWidgetActive(widget, true);
      this.setWidgetSelectedStrokeCount(widget, selectedStrokeCount);
      widget.object3D.visible = true;
      this.lastSelectionRevision = selectionRevision;
      return;
    }

    const lastPosition = widget.getVectorView(
      SelectionWidget,
      "lastPosition",
    ) as Float32Array;
    this.widgetPosition.copy(widget.object3D.position);
    this.movementDelta.set(
      this.widgetPosition.x - lastPosition[0],
      this.widgetPosition.y - lastPosition[1],
      this.widgetPosition.z - lastPosition[2],
    );

    if (this.movementDelta.lengthSq() > 0.0000001) {
      this.applyDeltaToSelectedStrokes(this.movementDelta, widget.object3D.parent);
      this.writeWidgetLastPosition(widget, this.widgetPosition);
    }
    this.setWidgetActive(widget, true);
    this.setWidgetSelectedStrokeCount(widget, selectedStrokeCount);
    widget.object3D.visible = true;
  }

  private computeSelectedStrokeCenter(out: Vector3, parent: Object3D | null): boolean {
    this.selectionBounds.makeEmpty();
    this.parentInverse.identity();
    if (parent) {
      parent.updateWorldMatrix(true, false);
      this.parentInverse.copy(parent.matrixWorld).invert();
    }

    for (const stroke of this.queries.strokes.entities) {
      if (!stroke.getValue(BrushStroke, "selected") || !stroke.object3D) {
        continue;
      }
      const minBounds = stroke.getVectorView(
        BrushStroke,
        "minBounds",
      ) as Float32Array;
      const maxBounds = stroke.getVectorView(
        BrushStroke,
        "maxBounds",
      ) as Float32Array;
      stroke.object3D.updateWorldMatrix(true, false);
      this.spaceMatrix.multiplyMatrices(this.parentInverse, stroke.object3D.matrixWorld);
      this.strokeBounds.min.fromArray(minBounds);
      this.strokeBounds.max.fromArray(maxBounds);
      this.selectionBounds.union(this.strokeBounds.applyMatrix4(this.spaceMatrix));
    }

    if (this.selectionBounds.isEmpty()) {
      return false;
    }

    this.selectionBounds.getCenter(out);
    return true;
  }

  private applyDeltaToSelectedStrokes(delta: Vector3, parent: Object3D | null): void {
    for (const stroke of this.queries.strokes.entities) {
      if (!stroke.getValue(BrushStroke, "selected") || !stroke.object3D) {
        continue;
      }
      this.world
        .getSystem(StrokeBatchRenderSystem)
        ?.beginStrokeExtraction(stroke);
      writeParentSpaceTranslation(this.localDelta, delta, parent, stroke.object3D.parent, this.translationMatrix, this.translationLinear);
      stroke.object3D.position.add(this.localDelta);
    }
  }

  private writeWidgetLastPosition(widget: Entity, position: Vector3): void {
    const lastPosition = widget.getVectorView(
      SelectionWidget,
      "lastPosition",
    ) as Float32Array;
    lastPosition[0] = position.x;
    lastPosition[1] = position.y;
    lastPosition[2] = position.z;
  }

  private setWidgetActive(widget: Entity, active: boolean): void {
    if (Boolean(widget.getValue(SelectionWidget, "active")) !== active) {
      widget.setValue(SelectionWidget, "active", active);
    }
  }

  private setWidgetInitialized(widget: Entity, initialized: boolean): void {
    if (
      Boolean(widget.getValue(SelectionWidget, "initialized")) !== initialized
    ) {
      widget.setValue(SelectionWidget, "initialized", initialized);
    }
  }

  private setWidgetSelectedStrokeCount(widget: Entity, count: number): void {
    if (Number(widget.getValue(SelectionWidget, "selectedStrokeCount")) !== count) {
      widget.setValue(SelectionWidget, "selectedStrokeCount", count);
    }
  }

  private getSelectionStateEntity(): Entity | undefined {
    const next = this.queries.selectionState.entities.values().next();
    return next.done ? undefined : next.value;
  }

  private getSelectionWidgetEntity(): Entity | undefined {
    const next = this.queries.widgets.entities.values().next();
    return next.done ? undefined : next.value;
  }
}
