import { Matrix3, Matrix4, Vector3, type Entity, type Object3D } from "@iwsdk/core";
import { CanvasLayer } from "../components/core.js";

export function findPaintLayer(layers: Iterable<Entity>, id: number): Entity | undefined {
  for (const entity of layers) {
    if (!entity.getValue(CanvasLayer, "selectionCanvas") && Number(entity.getValue(CanvasLayer, "layerIndex")) === id) return entity;
  }
  return undefined;
}

export function uniformWorldScale(object: Object3D, scratch: Vector3): number {
  object.getWorldScale(scratch);
  return Math.abs(scratch.x) || 1;
}

/** Convert a displacement, preserving length under parent scale. Scratch
 * matrices belong to the caller so selection movement allocates no garbage. */
export function writeParentSpaceTranslation(out: Vector3, delta: Vector3, from: Object3D | null, to: Object3D | null, matrix: Matrix4, linear: Matrix3): Vector3 {
  matrix.identity();
  if (to) { to.updateWorldMatrix(true, false); matrix.copy(to.matrixWorld).invert(); }
  if (from) { from.updateWorldMatrix(true, false); matrix.multiply(from.matrixWorld); }
  return out.copy(delta).applyMatrix3(linear.setFromMatrix4(matrix));
}
