import { readTiltStrokeData } from "three-tiltloader";
import {
  OpenBrushBinaryWriter,
  SKETCH_SENTINEL,
  SKETCH_VERSION,
  normalizeGuid,
} from "./binary.js";
import {
  CONTROL_POINT_EXTENSION_MASK,
  StrokeExtension,
  type StrokeData,
} from "../types.js";

export const ZERO_GUID = "00000000-0000-0000-0000-000000000000";

export interface SketchMemoryPayload {
  bytes: Uint8Array;
  brushGuids: string[];
}

export function writeSketchMemory(
  strokes: readonly StrokeData[],
  initialBrushGuids: readonly string[] = [],
): SketchMemoryPayload {
  const writer = new OpenBrushBinaryWriter();
  const brushGuids: string[] = initialBrushGuids.map(normalizeGuid);
  const brushIndexes = new Map<string, number>();
  brushGuids.forEach((guid, index) => {
    if (!brushIndexes.has(guid)) brushIndexes.set(guid, index);
  });

  writer.writeUint32(SKETCH_SENTINEL);
  writer.writeInt32(SKETCH_VERSION);
  writer.writeInt32(0);
  writer.writeUint32(0);
  writer.writeInt32(strokes.length);

  for (const stroke of strokes) {
    const brushGuid = normalizeGuid(stroke.brushGuid);
    let brushIndex = brushIndexes.get(brushGuid);
    if (brushIndex === undefined) {
      brushIndex = brushGuids.length;
      brushGuids.push(brushGuid);
      brushIndexes.set(brushGuid, brushIndex);
    }

    writer.writeInt32(brushIndex);
    writer.writeColor(stroke.color);
    writer.writeFloat32(stroke.brushSize);

    let strokeExtensionMask = StrokeExtension.Flags | StrokeExtension.Seed | StrokeExtension.Layer;
    if (stroke.brushScale !== 1) {
      strokeExtensionMask |= StrokeExtension.Scale;
    }
    if (stroke.groupId !== 0) {
      strokeExtensionMask |= StrokeExtension.Group;
    }

    writer.writeUint32(strokeExtensionMask);
    writer.writeUint32(CONTROL_POINT_EXTENSION_MASK);
    writer.writeUint32(stroke.flags);
    if ((strokeExtensionMask & StrokeExtension.Scale) !== 0) {
      writer.writeFloat32(stroke.brushScale);
    }
    if ((strokeExtensionMask & StrokeExtension.Group) !== 0) {
      writer.writeUint32(stroke.groupId);
    }
    writer.writeInt32(stroke.seed);
    writer.writeUint32(stroke.layerIndex);

    writer.writeInt32(stroke.controlPoints.length);
    for (const controlPoint of stroke.controlPoints) {
      writer.writeControlPoint(controlPoint);
    }
  }

  return { bytes: writer.toUint8Array(), brushGuids };
}

/** The shared parser owns persisted stroke semantics; the app retains its writer. */
export function readSketchMemory(
  bytes: Uint8Array,
  brushGuids: readonly string[],
): StrokeData[] {
  return readTiltStrokeData(bytes, brushGuids);
}
