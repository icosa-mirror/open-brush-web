import type { BrushGeometryArrays } from "./brush-geometry.js";

/** Keep the app's batch/binding contract tied to the upstream generator type. */
export type BrushVertexLayout = Pick<BrushGeometryArrays, "uv0Size" | "uv1Size">;

export function assertBrushVertexLayout(layout: BrushVertexLayout, context: string): void {
  if (![2, 3, 4].includes(layout.uv0Size) || ![0, 3, 4].includes(layout.uv1Size)) {
    throw new Error(`Brush vertex layout (${context}): unsupported UV widths ${layout.uv0Size}/${layout.uv1Size}.`);
  }
}

export function brushUv0Array(arrays: BrushGeometryArrays): Float32Array {
  return arrays.uv0Size === 2 ? arrays.uvs : arrays.uv0Size === 3 ? arrays.packedUvs : arrays.particleUvs;
}

/** Constant work: check channel capacities at copy/binding boundaries, not values
 * across every vertex. Unused pooled capacity and unused UV stores are allowed.
 */
export function assertBrushGeometryArrays(arrays: BrushGeometryArrays, context: string): void {
  assertBrushVertexLayout(arrays, context);
  const { vertexCount, indexCount } = arrays;
  if (!Number.isSafeInteger(vertexCount) || vertexCount < 0 || !Number.isSafeInteger(indexCount) || indexCount < 0 || indexCount % 3 || (vertexCount === 0 && indexCount !== 0)) {
    throw new Error(`Brush vertex layout (${context}): invalid vertex/index counts.`);
  }
  const channel = (name: string, values: Float32Array, size: number) => {
    if (!(values instanceof Float32Array) || values.length < vertexCount * size) {
      throw new Error(`Brush vertex layout (${context}): ${name} requires ${vertexCount * size} Float32 components.`);
    }
  };
  channel("position", arrays.positions, 3);
  channel("normal", arrays.normals, 3);
  channel("tangent", arrays.tangents, 4);
  channel("color", arrays.colors, 4);
  channel("base UV", arrays.uvs, 2);
  channel("shader UV0", brushUv0Array(arrays), arrays.uv0Size);
  if (arrays.uv1Size > 0) channel("shader UV1", arrays.uv1Size === 3 ? arrays.vectorUvs : arrays.uv1s, arrays.uv1Size);
  if (!(arrays.indices instanceof Uint32Array) || arrays.indices.length < indexCount) {
    throw new Error(`Brush vertex layout (${context}): insufficient Uint32 index storage.`);
  }
}
