// Bounded reader/checker for the uncompressed, single-mesh Unity fixture format.
// This is not a general glTF loader or a visual/production-export parity verdict.
const dimensions = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const components = { 5121: [1, "getUint8"], 5123: [2, "getUint16"], 5125: [4, "getUint32"], 5126: [4, "getFloat32"] };
const semantics = { position: "POSITION", normal: "NORMAL", tangent: "TANGENT", color: "COLOR_0", texcoord0: "TEXCOORD_0", texcoord1: "TEXCOORD_1", texcoord2: "TEXCOORD_2" };

function integer(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${name}.`);
  return value;
}

export function readFixtureGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) throw new Error("Invalid GLB header or byte length.");
  let json;
  let binary;
  let offset = 12;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) throw new Error("Truncated GLB chunk header.");
    const size = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    if (size % 4 || offset + 8 + size > bytes.byteLength) throw new Error("Invalid GLB chunk bounds/alignment.");
    const chunk = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 0x4e4f534a) {
      if (json || offset !== 12) throw new Error("Fixture GLB requires exactly one leading JSON chunk.");
      json = JSON.parse(new TextDecoder().decode(chunk));
    } else if (type === 0x004e4942) {
      if (binary) throw new Error("Multiple binary chunks are unsupported.");
      binary = chunk;
    } else throw new Error("Unsupported fixture GLB chunk type.");
    offset += 8 + size;
  }
  if (!json || json.asset?.version !== "2.0" || !binary || json.buffers?.length !== 1 || json.buffers[0].uri || integer(json.buffers[0].byteLength, "buffer length") > binary.byteLength) throw new Error("Fixture GLB requires glTF 2.0 and one embedded binary buffer.");
  return { json, binary };
}

export function readFixtureAccessor(glb, index) {
  integer(index, "accessor index");
  const accessor = glb.json.accessors?.[index];
  const component = accessor && components[accessor.componentType];
  const itemSize = accessor && dimensions[accessor.type];
  if (!accessor || !component || !itemSize || accessor.normalized || accessor.sparse) throw new Error(`Unsupported fixture accessor ${index}.`);
  const bufferView = glb.json.bufferViews?.[accessor.bufferView];
  if (!bufferView || bufferView.buffer !== 0) throw new Error(`Missing embedded buffer view for accessor ${index}.`);
  const count = integer(accessor.count, "accessor count", 1);
  const byteOffset = integer(bufferView.byteOffset ?? 0, "buffer-view offset");
  const byteLength = integer(bufferView.byteLength, "buffer-view length");
  const accessorOffset = integer(accessor.byteOffset ?? 0, "accessor offset");
  const [bytesPerComponent, getter] = component;
  const stride = integer(bufferView.byteStride ?? itemSize * bytesPerComponent, "accessor stride", itemSize * bytesPerComponent);
  const lastByte = accessorOffset + (count - 1) * stride + itemSize * bytesPerComponent;
  const declaredBufferLength = glb.json.buffers[0].byteLength;
  if (stride % bytesPerComponent || (byteOffset + accessorOffset) % bytesPerComponent || lastByte > byteLength || byteOffset + byteLength > declaredBufferLength) throw new Error(`Accessor ${index} exceeds its buffer view or has invalid alignment.`);
  const view = new DataView(glb.binary.buffer, glb.binary.byteOffset, glb.binary.byteLength);
  const data = new Float64Array(count * itemSize);
  for (let vertex = 0; vertex < count; vertex++) {
    for (let componentIndex = 0; componentIndex < itemSize; componentIndex++) {
      const value = view[getter](byteOffset + accessorOffset + vertex * stride + componentIndex * bytesPerComponent, true);
      if (!Number.isFinite(value)) throw new Error(`Nonfinite value in accessor ${index}.`);
      data[vertex * itemSize + componentIndex] = value;
    }
  }
  return { data, itemSize, count, componentType: accessor.componentType };
}

function linearColor(value) {
  if (value < 0 || value > 1) throw new Error("Gamma conversion outside the audited [0,1] color range is unsupported.");
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function expectedExportAttribute(name, attribute, colorSpace) {
  if (!["Gamma", "Linear"].includes(colorSpace)) throw new Error("Native color space must be explicitly Gamma or Linear.");
  const itemSize = integer(attribute.itemSize, "native attribute size", 1);
  const fixedSize = { position: 3, normal: 3, tangent: 4, color: 4 }[name];
  if (!semantics[name] || (fixedSize && itemSize !== fixedSize) || itemSize > 4) throw new Error(`Unsupported native attribute dimension for ${name}.`);
  if (!Array.isArray(attribute.data) || attribute.data.length % itemSize || attribute.data.some((x) => !Number.isFinite(x))) throw new Error(`Invalid native attribute data for ${name}.`);
  const exportedSize = ["texcoord0", "texcoord1"].includes(name) ? 2 : itemSize;
  if (itemSize < exportedSize) throw new Error(`Unsupported native attribute dimension for ${name}.`);
  const result = [];
  for (let offset = 0; offset < attribute.data.length; offset += itemSize) {
    const values = attribute.data.slice(offset, offset + exportedSize);
    if (["position", "normal", "tangent"].includes(name)) values[0] *= -1;
    if (name === "tangent") values[3] *= -1;
    if (["texcoord0", "texcoord1"].includes(name)) values[1] = 1 - values[1];
    if (name === "color" && colorSpace === "Gamma") for (let component = 0; component < 3; component++) values[component] = linearColor(values[component]);
    result.push(...values);
  }
  return { itemSize: exportedSize, data: result };
}

function compareValues(actual, expected, tolerance) {
  const lengthMatches = actual.length === expected.length;
  let maxAbsoluteError = 0;
  let mismatchedValues = 0;
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
    const error = Math.abs(actual[i] - expected[i]);
    maxAbsoluteError = Math.max(maxAbsoluteError, error);
    mismatchedValues += Number(error > tolerance);
  }
  return { match: lengthMatches && mismatchedValues === 0, lengthMatches, maxAbsoluteError, mismatchedValues };
}

export function comparePostBakerExport(fixture, glb, { colorSpace, tolerance = 1e-5 }) {
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error("Invalid export comparison tolerance.");
  if (fixture.schemaVersion !== 1 || fixture.strokes?.length !== 1) throw new Error("Expected a version-1 single-stroke native fixture.");
  const stage = fixture.strokes[0].postBrushBaker;
  if (!stage?.attributes?.position) throw new Error("Native post-BrushBaker positions are required.");
  integer(stage.vertexCount, "native vertex count", 1);
  integer(stage.indexCount, "native index count", 3);
  if (!stage || stage.subMeshCount !== 1 || stage.indexCount % 3 || stage.indices?.length !== stage.indexCount) throw new Error("Unsupported native triangle/submesh contract.");
  if (stage.indices.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= stage.vertexCount)) throw new Error("Invalid native triangle indices.");
  if (glb.json.meshes?.length !== 1 || glb.json.meshes[0].primitives?.length !== 1) throw new Error("Expected one exported fixture primitive.");
  const primitive = glb.json.meshes[0].primitives[0];
  if ((primitive.mode ?? 4) !== 4) throw new Error("Expected exported triangle topology.");
  const channels = {};
  const droppedComponents = [];
  for (const [name, attribute] of Object.entries(stage.attributes)) {
    const semantic = semantics[name];
    if (!semantic) throw new Error(`Unchecked native attribute ${name}.`);
    if (attribute.data?.length !== stage.vertexCount * attribute.itemSize) throw new Error(`Native vertex count differs for ${name}.`);
    const expected = expectedExportAttribute(name, attribute, colorSpace);
    if (primitive.attributes[semantic] === undefined) { channels[name] = { match: false, missing: true }; continue; }
    const actual = readFixtureAccessor(glb, primitive.attributes[semantic]);
    channels[name] = { ...compareValues(actual.data, expected.data, tolerance), nativeSize: attribute.itemSize, exportedSize: actual.itemSize, vertexCount: actual.count };
    channels[name].match &&= actual.itemSize === expected.itemSize && actual.count === stage.vertexCount;
    for (let component = expected.itemSize; component < attribute.itemSize; component++) {
      let min = Infinity; let max = -Infinity; let nonzeroCount = 0;
      for (let vertex = 0; vertex < stage.vertexCount; vertex++) {
        const value = attribute.data[vertex * attribute.itemSize + component];
        min = Math.min(min, value); max = Math.max(max, value); nonzeroCount += Number(value !== 0);
      }
      droppedComponents.push({ attribute: name, component, min, max, nonzeroCount });
    }
  }
  const uncheckedExportedAttributes = Object.keys(primitive.attributes).filter((semantic) => !Object.entries(semantics).some(([name, value]) => value === semantic && stage.attributes[name]));
  const indices = readFixtureAccessor(glb, primitive.indices);
  if (![5121, 5123, 5125].includes(indices.componentType)) throw new Error("Fixture indices must be unsigned integers.");
  const expectedIndices = [];
  for (let i = 0; i < stage.indices.length; i += 3) expectedIndices.push(stage.indices[i + 2], stage.indices[i + 1], stage.indices[i]);
  const indexComparison = compareValues(indices.data, expectedIndices, 0);
  indexComparison.match &&= indices.itemSize === 1;
  const generator = glb.json.asset?.generator ?? "";
  return {
    exporterTransformMatch: Object.values(channels).every((channel) => channel.match) && indexComparison.match && uncheckedExportedAttributes.length === 0,
    channels, indices: indexComparison, uncheckedExportedAttributes, droppedComponents,
    generator, fixtureMarker: generator.includes("Open Brush UnityGLTF Mesh Fixture"),
    threeIcosaNewExporterFlag: generator.includes("Open Brush UnityGLTF Exporter"),
    bakerMappingFound: Boolean(fixture.strokes[0].brushBaker?.mappingFound),
    materialNames: (glb.json.materials ?? []).map((material) => material.name ?? null),
    postThreeIcosa: "unverified", productionSceneExport: "unverified", visualParity: "unverified",
  };
}
