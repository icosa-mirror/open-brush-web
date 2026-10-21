import { describe, expect, it } from "vitest";
import { comparePostBakerExport, readFixtureAccessor, readFixtureGlb } from "./unity-glb-export-contract.mjs";

function glbBytes(json, binary) {
  const text = Buffer.from(JSON.stringify(json));
  const jsonLength = Math.ceil(text.length / 4) * 4;
  const binaryLength = Math.ceil(binary.length / 4) * 4;
  const bytes = Buffer.alloc(12 + 8 + jsonLength + 8 + binaryLength);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(jsonLength, 12); bytes.writeUInt32LE(0x4e4f534a, 16);
  bytes.fill(0x20, 20, 20 + jsonLength); text.copy(bytes, 20);
  bytes.writeUInt32LE(binaryLength, 20 + jsonLength); bytes.writeUInt32LE(0x004e4942, 24 + jsonLength);
  binary.copy(bytes, 28 + jsonLength);
  return bytes;
}

function triangle() {
  const source = {
    position: { itemSize: 3, data: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    tangent: { itemSize: 4, data: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1] },
    texcoord0: { itemSize: 4, data: [0.25, 0.75, 2, 3, 0.25, 0.75, 2, 3, 0.25, 0.75, 2, 3] },
    color: { itemSize: 4, data: [0.2, 0.2, 0.2, 1, 0.2, 0.2, 0.2, 1, 0.2, 0.2, 0.2, 1] },
  };
  // Independent, explicit exporter results: X reflection, tangent W reflection,
  // V inversion/XY truncation, sRGB-to-linear color and reversed winding.
  const arrays = [
    ["POSITION", 3, new Float32Array([-1, 2, 3, -4, 5, 6, -7, 8, 9])],
    ["TANGENT", 4, new Float32Array([-1, 0, 0, -1, -1, 0, 0, -1, -1, 0, 0, -1])],
    ["TEXCOORD_0", 2, new Float32Array([0.25, 0.25, 0.25, 0.25, 0.25, 0.25])],
    ["COLOR_0", 4, new Float32Array([0.03310477, 0.03310477, 0.03310477, 1, 0.03310477, 0.03310477, 0.03310477, 1, 0.03310477, 0.03310477, 0.03310477, 1])],
    ["indices", 1, new Uint16Array([2, 1, 0])],
  ];
  const views = []; const accessors = []; const buffers = []; const attributes = {};
  let offset = 0;
  for (const [semantic, itemSize, values] of arrays) {
    views.push({ buffer: 0, byteOffset: offset, byteLength: values.byteLength });
    accessors.push({ bufferView: views.length - 1, componentType: semantic === "indices" ? 5123 : 5126, count: 3, type: itemSize === 1 ? "SCALAR" : `VEC${itemSize}` });
    if (semantic !== "indices") attributes[semantic] = accessors.length - 1;
    buffers.push(Buffer.from(values.buffer)); offset += values.byteLength;
  }
  const json = { asset: { version: "2.0", generator: "Open Brush UnityGLTF Mesh Fixture test" }, buffers: [{ byteLength: offset }], bufferViews: views, accessors,
    meshes: [{ primitives: [{ attributes, indices: accessors.length - 1 }] }] };
  const fixture = { schemaVersion: 1, strokes: [{ brushBaker: { mappingFound: true }, postBrushBaker: { vertexCount: 3, indexCount: 3, subMeshCount: 1, attributes: source, indices: [0, 1, 2] } }] };
  return { fixture, json, binary: Buffer.concat(buffers), bytes: glbBytes(json, Buffer.concat(buffers)) };
}

describe("isolated UnityGLTF fixture export contract", () => {
  it("checks actual accessor values while exposing expected UV component loss and fixture scope", () => {
    const { fixture, bytes } = triangle();
    const result = comparePostBakerExport(fixture, readFixtureGlb(bytes), { colorSpace: "Gamma" });
    expect(result.exporterTransformMatch).toBe(true);
    expect(result.droppedComponents).toEqual([
      { attribute: "texcoord0", component: 2, min: 2, max: 2, nonzeroCount: 3 },
      { attribute: "texcoord0", component: 3, min: 3, max: 3, nonzeroCount: 3 },
    ]);
    expect(result.fixtureMarker).toBe(true);
    expect(result.threeIcosaNewExporterFlag).toBe(false);
    expect(result.productionSceneExport).toBe("unverified");
  });
  it("detects changed exported values and an incorrectly declared color-space model", () => {
    const { fixture, json, binary } = triangle();
    binary.writeFloatLE(123, 0);
    expect(comparePostBakerExport(fixture, readFixtureGlb(glbBytes(json, binary)), { colorSpace: "Gamma" }).exporterTransformMatch).toBe(false);
    const original = triangle();
    expect(comparePostBakerExport(original.fixture, readFixtureGlb(original.bytes), { colorSpace: "Linear" }).channels.color.match).toBe(false);
  });
  it("rejects truncated GLBs, sparse/normalized accessors and out-of-view reads", () => {
    const { bytes } = triangle();
    expect(() => readFixtureGlb(bytes.subarray(0, bytes.length - 1))).toThrow("header or byte length");
    const parsed = readFixtureGlb(bytes); parsed.json.accessors[0].normalized = true;
    expect(() => readFixtureAccessor(parsed, 0)).toThrow("Unsupported fixture accessor");
    delete parsed.json.accessors[0].normalized; parsed.json.bufferViews[0].byteLength = 4;
    expect(() => readFixtureAccessor(parsed, 0)).toThrow("exceeds its buffer view");
  });
  it("honors interleaved buffer strides", () => {
    const data = new Float32Array([1, 2, 3, 99, 4, 5, 6, 99]);
    const json = { asset: { version: "2.0" }, buffers: [{ byteLength: data.byteLength }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: data.byteLength, byteStride: 16 }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 2, type: "VEC3" }] };
    expect([...readFixtureAccessor(readFixtureGlb(glbBytes(json, Buffer.from(data.buffer))), 0).data]).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("rejects nonfinite values and invalid native indices instead of reporting a vacuous match", () => {
    const { fixture, bytes } = triangle(); fixture.strokes[0].postBrushBaker.indices[0] = NaN;
    expect(() => comparePostBakerExport(fixture, readFixtureGlb(bytes), { colorSpace: "Gamma" })).toThrow("Invalid native triangle indices");
    const data = triangle(); data.binary.writeFloatLE(Infinity, 0);
    expect(() => readFixtureAccessor(readFixtureGlb(glbBytes(data.json, data.binary)), 0)).toThrow("Nonfinite");
  });
});
