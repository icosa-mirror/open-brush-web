/**
 * Tilt Brush unit conversion.
 *
 * Open Brush / Tilt Brush author sketches in "Tilt Brush units", where one
 * unit is a decimetre — see App.cs: `METERS_TO_UNITS = 10`,
 * `UNITS_TO_METERS = 0.1`. The web runtime uses metres and reflects native Z
 * coordinates. The file reader/writer own the complete inverse transform.
 *
 * Runtime strokes must not receive a second import conversion. Older web
 * files wrote web coordinates directly; the file boundary recognizes those
 * separately from native files and new explicitly marked native exports.
 */

import { createSketchDocument, type SketchDocument } from "./document.js";
import type { ControlPoint, StrokeData } from "../types.js";

/** Open Brush `App.UNITS_TO_METERS`: one Tilt Brush unit is a decimetre. */
export const UNITS_TO_METERS = 0.1;

/** Native Unity coordinates use decimetres and a reflected Z axis. */
export function nativeTiltStrokeToWeb(stroke: StrokeData): StrokeData {
  return reflectAndScaleStroke(stroke, UNITS_TO_METERS);
}

/** The file boundary is the inverse of the native-to-web coordinate transform. */
export function webStrokeToNativeTilt(stroke: StrokeData): StrokeData {
  return reflectAndScaleStroke(stroke, 1 / UNITS_TO_METERS);
}

function reflectAndScaleStroke(stroke: StrokeData, scale: number): StrokeData {
  return {
    ...stroke,
    brushSize: stroke.brushSize * scale,
    controlPoints: stroke.controlPoints.map(point => ({
      ...point,
      position: [point.position[0] * scale, point.position[1] * scale, -point.position[2] * scale],
      // S * R * S for S = diag(1, 1, -1).
      orientation: [-point.orientation[0], -point.orientation[1], point.orientation[2], point.orientation[3]],
    })),
  };
}

/**
 * Scale-only utility: preserves handedness/orientation. Native file import uses
 * nativeTiltStrokeToWeb instead; readTiltFile already returns web coordinates.
 */
export function convertTiltBrushUnitsToMeters(
  document: SketchDocument,
  scale: number = UNITS_TO_METERS,
): SketchDocument {
  const strokes = document.strokes.map<StrokeData>((stroke) => ({
    ...stroke,
    brushSize: stroke.brushSize * scale,
    controlPoints: stroke.controlPoints.map<ControlPoint>((point) => ({
      ...point,
      position: [
        point.position[0] * scale,
        point.position[1] * scale,
        point.position[2] * scale,
      ],
    })),
  }));

  return createSketchDocument({
    metadata: document.metadata,
    layers: document.layers,
    media: document.media,
    strokes,
    tiltArchive: document.tiltArchive,
  });
}
