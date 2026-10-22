import type { SketchLayerTransform } from "./document.js";
import type { Vec3, Quat } from "../types.js";
import { UNITS_TO_METERS } from "./tilt-brush-units.js";

function tuple(value: unknown, length: number): number[] {
  if (!Array.isArray(value) || value.length !== length || value.some(number => typeof number !== "number" || !Number.isFinite(number))) {
    throw new Error("Invalid sketch layer transform tuple.");
  }
  return value;
}

function unitRotation(value: unknown): Quat {
  const q = tuple(value, 4), length = Math.hypot(...q);
  if (!Number.isFinite(length) || length === 0) throw new Error("Sketch layer rotation must have a finite nonzero length.");
  return q.map(number => Math.abs(length - 1) <= Number.EPSILON * 4 ? number : number / length) as Quat;
}

export function readWebLayerTransform(value: unknown): SketchLayerTransform | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") throw new Error("Invalid web layer transform.");
  const pose = value as SketchLayerTransform;
  if (!Number.isFinite(pose.scale) || pose.scale <= 0) throw new Error("Sketch layer scale must be positive and finite.");
  return { position: [...tuple(pose.position, 3)] as Vec3, rotation: unitRotation(pose.rotation), scale: Math.min(1e4, Math.max(1e-4, pose.scale)) };
}

/** Native CanvasScript.LocalPose takes abs(scale), clamps to 1e-4..1e4;
 * SaveLoadScript first changes a legacy zero scale to one. */
export function nativeLayerTransformToWeb(value: unknown): SketchLayerTransform | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length !== 3 || typeof value[2] !== "number" || !Number.isFinite(value[2])) throw new Error("Invalid native layer transform.");
  const position = tuple(value[0], 3), rotation = unitRotation(value[1]);
  const scale = Math.min(1e4, Math.max(1e-4, Math.abs(value[2] === 0 ? 1 : value[2])));
  const result: SketchLayerTransform = {
    position: [position[0] * UNITS_TO_METERS, position[1] * UNITS_TO_METERS, -position[2] * UNITS_TO_METERS || 0],
    rotation: [-rotation[0] || 0, -rotation[1] || 0, rotation[2], rotation[3]], scale,
  };
  return sameLayerTransform(result, undefined) ? undefined : result;
}

export function webLayerTransformToNative(value: SketchLayerTransform): [Vec3, Quat, number] {
  const pose = readWebLayerTransform(value)!;
  return [[pose.position[0] / UNITS_TO_METERS, pose.position[1] / UNITS_TO_METERS, -pose.position[2] / UNITS_TO_METERS || 0],
    [-pose.rotation[0] || 0, -pose.rotation[1] || 0, pose.rotation[2], pose.rotation[3]], pose.scale];
}

/** Missing transforms are identity. Preserve raw native fields when the
 * effective pose has not been edited, including legacy scale encodings. */
export function sameLayerTransform(a: SketchLayerTransform | undefined, b: SketchLayerTransform | undefined): boolean {
  const identity = { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: 1 };
  const x = a ?? identity, y = b ?? identity;
  return x.scale === y.scale && x.position.every((number, index) => number === y.position[index]) && x.rotation.every((number, index) => number === y.rotation[index]);
}
