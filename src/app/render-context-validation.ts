import { World, type FogExp2, type Entity } from "@iwsdk/core";
import { OpenBrushAppState, OpenBrushScenePose } from "../components/core.js";
import { LayerCanvasSystem } from "../systems/layer-canvas-system.js";
import { StrokeAuthoringSystem } from "../systems/stroke-authoring-system.js";
import { SketchLibrarySystem } from "../systems/sketch-library-system.js";
import { StandardEnvironmentSystem } from "../systems/standard-environment-system.js";
import { openBrushShaderLibrary } from "../brushes/brush-shader-library.js";
import { openBrushInventory } from "../brushes/brush-catalog.js";
import { OPENBRUSH_AMBIENT_LIGHT_COLOR, OPENBRUSH_FOG_DENSITY } from "../brushes/brush-shader-materials.js";
import { createSketchDocument, type SketchDocument } from "../sketch/document.js";
import { readTiltFile, writeTiltFile } from "../sketch/tilt-file.js";

function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }
function close(actual: readonly number[], expected: readonly number[]) { return actual.length === expected.length && actual.every((value, i) => Math.abs(value - expected[i]) < 1e-5); }

export async function validateRenderContext(container: HTMLDivElement) {
  const world = await World.create(container, { xr: false, render: { defaultLighting: false }, features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  world.registerSystem(LayerCanvasSystem).registerSystem(StandardEnvironmentSystem).registerSystem(StrokeAuthoringSystem);
  world.createTransformEntity().addComponent(OpenBrushAppState, { mode: "intro" });
  const scene = world.createTransformEntity().addComponent(OpenBrushScenePose);
  scene.object3D!.rotation.y = Math.PI / 2; scene.object3D!.scale.setScalar(2);
  world.player.position.set(0, 0, 0); world.player.quaternion.identity(); world.camera.position.set(0, 0, 0); world.camera.quaternion.identity();
  const frames = async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };
  await frames();
  const receiver: { world: typeof world; activeDocumentContext?: SketchDocument } = { world };
  const apply = (document?: SketchDocument) => (SketchLibrarySystem.prototype as unknown as { setDocumentContext(document?: SketchDocument): void }).setDocumentContext.call(receiver, document);
  const metadata = { Environment: { FogColor: [31, 31, 78, 255], FogDensity: 0.0014 }, Lights: {
    Ambient: [64, 128, 255, 255], Shadow: { Orientation: [0, 0, 0, 1], Color: [4, 2, 1, 1] }, NoShadow: { Orientation: [0, 0, 0, 1], Color: [0.1, 0.2, 0.3, 1] } } };
  const original = JSON.stringify(metadata);
  const file = readTiltFile(writeTiltFile(createSketchDocument({ tiltArchive: { metadata, entries: [] } })));
  apply(file); await frames();
  const uniforms = openBrushShaderLibrary.frameUniforms;
  const fog = world.scene.fog as FogExp2;
  const initial = { shaderDensity: uniforms.u_fogDensity.value, sceneDensity: fog.density, ambient: uniforms.u_ambient_light_color.value.toArray(), light0: uniforms.u_SceneLight_0_color.value.toArray(), direction: uniforms.u_SceneLight_0_matrix.value.elements.slice(8, 11) };
  check(Math.abs(initial.shaderDensity - 0.0007) < 1e-9 && Math.abs(initial.sceneDensity - 0.007) < 1e-9, "Native density/unit/scene-scale mapping differs");
  check(close(initial.ambient, [64 / 255, 128 / 255, 1, 1]) && close(initial.light0, [4, 2, 1, 1]), "Loaded ambient/HDR light colors were not applied");
  check(close(initial.direction, [1, 0, 0]), "Scene-local light orientation did not follow scene rotation independently of scale");
  check(close(uniforms.u_fogColor.value.toArray(), [31 / 255, 31 / 255, 78 / 255]), "Loaded fog color was not applied");
  const material = await openBrushShaderLibrary.load(openBrushInventory.find(entry => entry.name === "OilPaint")!);
  check(!!material && material.uniforms.u_fogDensity === uniforms.u_fogDensity && material.uniforms.u_SceneLight_0_color === uniforms.u_SceneLight_0_color, "Late material did not share the loaded context holders");
  scene.object3D!.scale.setScalar(4); await frames();
  check(Math.abs(uniforms.u_fogDensity.value - 0.00035) < 1e-9 && Math.abs(fog.density - 0.0035) < 1e-9 && close(uniforms.u_SceneLight_0_matrix.value.elements.slice(8, 11), [1, 0, 0]), "Scaling changed fog exponent/light direction");
  apply(readTiltFile(writeTiltFile(createSketchDocument({ tiltArchive: { metadata: { ...metadata, Environment: { ...metadata.Environment, FogDensity: 0 } }, entries: [] } })))); await frames();
  check(uniforms.u_fogDensity.value === 0 && fog.density === 0, "Explicit zero fog fell back to a default");
  apply(); await frames();
  check(openBrushShaderLibrary.fogDensityNative === OPENBRUSH_FOG_DENSITY && Math.abs(uniforms.u_fogDensity.value - 0.0025 / 4) < 1e-9 && close(uniforms.u_ambient_light_color.value.toArray(), OPENBRUSH_AMBIENT_LIGHT_COLOR), "New document retained prior custom context");
  check(JSON.stringify(metadata) === original && JSON.stringify(file.tiltArchive!.metadata.Environment) === JSON.stringify(metadata.Environment), "Context application rewrote source metadata");
  const deadline = performance.now() + 20000;
  while (!world.scene.getObjectByName("OpenBrushEnvironmentStandard") && performance.now() < deadline) await frames();
  check(!!world.scene.getObjectByName("OpenBrushEnvironmentStandard"), "Environment asset did not finish loading");
  return { passed: true, initial, scale4ShaderDensity: 0.00035, scale4SceneDensity: 0.0035, zeroFogPreserved: true, lateMaterialSharesContext: true, resetRestoresStandard: true, metadataUnchanged: true,
    scope: "Production document context method, shader holders, per-frame scene pose and loaded geometry fog; synthetic native file data, no native pixels, presets/skyboxes or physical XR" };
}
