import { AssetManager, Mesh, ShaderMaterial, World } from "@iwsdk/core";
import type { BufferAttribute, InterleavedBufferAttribute } from "@iwsdk/core";
import { GLTFGoogleTiltBrushMaterialExtension } from "three-icosa";
import { resolveBrushAssetBaseUrl } from "./brush-asset-base-url.js";

type Attribute = BufferAttribute | InterleavedBufferAttribute;
let sharedLoader: GLTFGoogleTiltBrushMaterialExtension["tiltShaderLoader"] | undefined;

export async function initializeExportInspection() {
  const container = document.createElement("div");
  container.style.cssText = "width:640px;height:480px";
  document.body.append(container);
  await World.create(container, { xr: false });
}

async function describeAttribute(attribute: Attribute) {
  const values = new Float64Array(attribute.count * attribute.itemSize);
  let nonfiniteCount = 0;
  for (let i = 0; i < attribute.count; i++) {
    for (let c = 0; c < attribute.itemSize; c++) {
      const value = attribute.getComponent(i, c);
      values[i * attribute.itemSize + c] = value;
      if (!Number.isFinite(value)) nonfiniteCount++;
    }
  }
  const hash = await crypto.subtle.digest("SHA-256", values.buffer);
  return {
    itemSize: attribute.itemSize, count: attribute.count,
    normalized: attribute.normalized, arrayType: attribute.array.constructor.name,
    decodedFloat64Sha256: Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, "0")).join(""),
    nonfiniteCount,
  };
}

async function describeMesh(mesh: Mesh) {
  const attributes = Object.fromEntries(await Promise.all(
    Object.entries(mesh.geometry.attributes).map(async ([name, attribute]) => [name, await describeAttribute(attribute)] as const),
  ));
  const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((material) => ({
    name: material.name, type: material.type,
    newExporterFlag: material instanceof ShaderMaterial ? material.uniforms.u_isNewTiltExporter?.value ?? null : null,
    declaredAttributes: material instanceof ShaderMaterial
      ? Array.from(material.vertexShader.matchAll(/\b(?:attribute|in)\s+(?:(?:lowp|mediump|highp)\s+)?(float|vec[234])\s+(\w+)\s*;/g), (match) => ({ type: match[1], name: match[2] })) : [],
  }));
  return { attributes, index: mesh.geometry.index ? await describeAttribute(mesh.geometry.index) : null,
    materials, groups: mesh.geometry.groups.map((group) => ({ ...group })) };
}

function expectedColor(mesh: Mesh) {
  const source = mesh.geometry.getAttribute("color");
  if (!source || !(source.array instanceof Float32Array) || ![3, 4].includes(source.itemSize)) return null;
  const values = new Uint8Array(source.count * source.itemSize);
  for (let i = 0; i < source.count; i++) for (let c = 0; c < source.itemSize; c++) {
    const value = source.getComponent(i, c);
    if (!Number.isFinite(value) || value < 0 || value > 1) return null;
    const srgb = c === 3 ? value : value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
    values[i * source.itemSize + c] = Math.round(srgb * 255);
  }
  return { values, count: source.count, itemSize: source.itemSize };
}

function compareColor(mesh: Mesh, expected: ReturnType<typeof expectedColor>) {
  const actual = mesh.geometry.getAttribute("a_color");
  if (!actual) return { status: "not-bound" };
  if (!expected) return { status: "unsupported-source" };
  if (actual.count !== expected.count || actual.itemSize !== expected.itemSize) return { status: "shape-mismatch" };
  let mismatchedValues = 0;
  for (let i = 0; i < actual.count; i++) for (let c = 0; c < actual.itemSize; c++) {
    if (Math.abs(actual.getComponent(i, c) - expected.values[i * actual.itemSize + c] / 255) > 1e-12) mismatchedValues++;
  }
  return { status: mismatchedValues ? "value-mismatch" : "linear-to-srgb-byte-match", mismatchedValues };
}

/** Diagnostic only: no renderer invocation, no forced exporter flag or scene attachment.
 * AssetManager does not expose plugin registration, so beforeRoot is not exercised.
 */
export async function inspectBrushExport(url: string) {
  const gltf = await AssetManager.loadGLTF(url);
  const meshes: Mesh[] = [];
  const seen = new Set<Mesh>();
  for (const scene of gltf.scenes) scene.traverse((object) => {
    if (object instanceof Mesh && !seen.has(object)) { seen.add(object); meshes.push(object); }
  });
  if (!meshes.length) throw new Error("GLB contains no inspectable meshes.");
  const before = await Promise.all(meshes.map(describeMesh));
  const colors = meshes.map(expectedColor);
  const extension = new GLTFGoogleTiltBrushMaterialExtension(gltf.parser, resolveBrushAssetBaseUrl());
  // The maintained loader caches parsed materials per instance. Reuse that
  // cache across files rather than creating competing loaders in this harness.
  sharedLoader ??= extension.tiltShaderLoader;
  extension.tiltShaderLoader = sharedLoader;
  await extension.afterRoot(gltf);
  const after = await Promise.all(meshes.map(describeMesh));
  return {
    scope: "AssetManager GLB decoding followed by three-icosa afterRoot attribute inspection; beforeRoot, render and visual parity unverified",
    generator: gltf.parser.json.asset?.generator ?? null,
    brushAssetBaseUrl: resolveBrushAssetBaseUrl(),
    sourceMaterials: (gltf.parser.json.materials ?? []).map((material: { name?: string }) => material.name ?? null),
    newExporterDetected: gltf.scenes.map((scene) => scene.userData.isNewTiltExporter),
    meshes: meshes.map((mesh, i) => ({
      name: mesh.name, before: before[i], after: after[i],
      colorConversion: compareColor(mesh, colors[i]),
      aliasObservations: Object.entries(after[i].attributes).filter(([name]) => name.startsWith("a_")).map(([name, attribute]) => ({
        name,
        equalBeforeAttributes: Object.entries(before[i].attributes).filter(([, original]) => original.count === attribute.count && original.itemSize === attribute.itemSize && original.decodedFloat64Sha256 === attribute.decodedFloat64Sha256).map(([source]) => source),
      })),
    })),
  };
}
