import { describe, expect, it } from "vitest";
import { createBrushGeometryArrays } from "./brush-geometry.js";
import { assertBrushGeometryArrays, brushUv0Array } from "./brush-vertex-layout.js";
import { StrokeBatch } from "./stroke-batch.js";

function triangle() {
  const arrays = createBrushGeometryArrays();
  arrays.vertexCount = 3;
  arrays.indexCount = 3;
  arrays.indices.set([0, 1, 2]);
  return arrays;
}

describe("generated brush vertex layout", () => {
  it("supports every current UV layout with spare capacity and unused stores", () => {
    for (const uv0Size of [2, 3, 4] as const) for (const uv1Size of [0, 3, 4] as const) {
      const arrays = triangle();
      arrays.uv0Size = uv0Size;
      arrays.uv1Size = uv1Size;
      expect(() => assertBrushGeometryArrays(arrays, "test-brush")).not.toThrow();
      expect(brushUv0Array(arrays)).toBe(uv0Size === 2 ? arrays.uvs : uv0Size === 3 ? arrays.packedUvs : arrays.particleUvs);
    }
  });

  it("rejects absent/short required channels with an attributable error", () => {
    const arrays = triangle();
    arrays.uv0Size = 3;
    arrays.packedUvs = new Float32Array(8);
    expect(() => assertBrushGeometryArrays(arrays, "test-brush")).toThrow("test-brush): shader UV0 requires 9");
    arrays.packedUvs = new Float32Array(9);
    arrays.uv1Size = 4;
    arrays.uv1s = new Float32Array(11);
    expect(() => assertBrushGeometryArrays(arrays, "test-brush")).toThrow("shader UV1 requires 12");
    arrays.uv1Size = 0;
    arrays.normals = undefined as unknown as Float32Array;
    expect(() => assertBrushGeometryArrays(arrays, "test-brush")).toThrow("normal requires 9");
  });

  it("rejects invalid counts and short index storage without scanning values", () => {
    const arrays = triangle();
    arrays.indexCount = 4;
    expect(() => assertBrushGeometryArrays(arrays, "test-brush")).toThrow("invalid vertex/index counts");
    arrays.indexCount = 3;
    arrays.indices = new Uint32Array(2);
    expect(() => assertBrushGeometryArrays(arrays, "test-brush")).toThrow("index storage");
    arrays.vertexCount = NaN;
    expect(() => assertBrushGeometryArrays(arrays, "test-brush")).toThrow("invalid vertex/index counts");
  });

  it("rejects incompatible batches before changing geometry or subset bookkeeping", () => {
    const batch = new StrokeBatch({ uv0Size: 2, uv1Size: 0 });
    const arrays = triangle();
    arrays.uv0Size = 4;
    expect(() => batch.addSubset("different-layout", arrays)).toThrow("generated UV widths differ");
    arrays.uv0Size = 2;
    arrays.colors = new Float32Array(0);
    expect(() => batch.addSubset("short-colors", arrays)).toThrow("color requires 12");
    expect(batch.vertexCount).toBe(0);
    expect(batch.indexCount).toBe(0);
    expect(batch.subsets).toHaveLength(0);
  });
});
