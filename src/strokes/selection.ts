import type { StrokeData, Vec3 } from "../types.js";

export interface RuntimeStrokeSelectionState {
  /** Native explicit selection tag; absent/zero means ungrouped. */
  groupId?: number;
  layerIndex: number;
  commandIndex: number;
  visible: boolean;
  renderVisible: boolean;
  finalized: boolean;
  selected: boolean;
}

export interface StrokeSelectionSummary {
  selectedStrokeCount: number;
  activeSelectionLayerIndex: number;
  lastSelectedStrokeCommandIndex: number;
}

export interface RuntimeStrokeTransformState {
  commandIndex: number;
  selected: boolean;
  position: Vec3;
}

export interface StrokeTransformTarget {
  commandIndex: number;
  position: Vec3;
}

export function resolveLastSelectableStroke(
  strokes: RuntimeStrokeSelectionState[],
  activeLayerIndex: number,
): RuntimeStrokeSelectionState | undefined {
  let selectedStroke: RuntimeStrokeSelectionState | undefined;
  for (const stroke of strokes) {
    if (
      stroke.layerIndex !== activeLayerIndex ||
      !stroke.visible ||
      !stroke.renderVisible ||
      !stroke.finalized
    ) {
      continue;
    }
    if (!selectedStroke || stroke.commandIndex > selectedStroke.commandIndex) {
      selectedStroke = stroke;
    }
  }
  return selectedStroke;
}

/** Native SelectCommand expands an explicit group across canvases. Rendered
 * visibility/layer filtering chooses the initial hit, not its active members. */
export function resolveStrokeSelectionGroup(
  strokes: readonly RuntimeStrokeSelectionState[],
  target: RuntimeStrokeSelectionState,
): number[] {
  if (!target.groupId) return [target.commandIndex];
  return strokes.filter(stroke => stroke.groupId === target.groupId && stroke.visible && stroke.finalized)
    .map(stroke => stroke.commandIndex).sort((a, b) => a - b);
}

export function summarizeStrokeSelection(
  strokes: RuntimeStrokeSelectionState[],
): StrokeSelectionSummary {
  let selectedStrokeCount = 0;
  let activeSelectionLayerIndex = -1;
  let lastSelectedStrokeCommandIndex = 0;
  let hasMixedLayerSelection = false;

  for (const stroke of strokes) {
    if (!stroke.selected) {
      continue;
    }
    selectedStrokeCount += 1;
    lastSelectedStrokeCommandIndex = Math.max(
      lastSelectedStrokeCommandIndex,
      stroke.commandIndex,
    );

    if (selectedStrokeCount === 1) {
      activeSelectionLayerIndex = stroke.layerIndex;
    } else if (activeSelectionLayerIndex !== stroke.layerIndex) {
      hasMixedLayerSelection = true;
      activeSelectionLayerIndex = -1;
    }
  }

  return {
    selectedStrokeCount,
    activeSelectionLayerIndex: hasMixedLayerSelection
      ? -1
      : activeSelectionLayerIndex,
    lastSelectedStrokeCommandIndex,
  };
}

export function planSelectedStrokeTranslation(
  strokes: readonly RuntimeStrokeTransformState[],
  delta: Vec3,
): StrokeTransformTarget[] {
  const targets: StrokeTransformTarget[] = [];
  for (const stroke of strokes) {
    if (!stroke.selected) {
      continue;
    }
    targets.push({
      commandIndex: stroke.commandIndex,
      position: [
        stroke.position[0] + delta[0],
        stroke.position[1] + delta[1],
        stroke.position[2] + delta[2],
      ],
    });
  }
  return targets.sort((left, right) => left.commandIndex - right.commandIndex);
}

/** Bakes a canvas-space selection translation into serialized control points. */
export function translateStrokeDataControlPoints(
  stroke: StrokeData,
  delta: Vec3,
): void {
  for (const point of stroke.controlPoints) {
    point.position[0] += delta[0];
    point.position[1] += delta[1];
    point.position[2] += delta[2];
  }
}

/** Snapshot a private mesh's translation without changing its live data. */
export function createTranslatedStrokeSnapshot(
  stroke: StrokeData,
  delta: Vec3,
): StrokeData {
  if (delta[0] === 0 && delta[1] === 0 && delta[2] === 0) return stroke;
  const snapshot = structuredClone(stroke);
  translateStrokeDataControlPoints(snapshot, delta);
  return snapshot;
}
