import { expect, it } from "vitest";
import { brushFogDensity, readNativeSketchRenderContext, sceneFogDensity } from "./render-context.js";

it("reads native byte colors, HDR lights and scene-local rotations while retaining metadata", () => {
  const metadata = { EnvironmentPreset: "preset", Environment: { FogColor: [31, 31, 78, 255], FogDensity: 0, ReflectionIntensity: 0.4 },
    Lights: { Ambient: [64, 128, 255, 255], Shadow: { Orientation: [0.5, 0, 0, Math.sqrt(0.75)], Color: [32, 2, 0, 1] }, NoShadow: { Orientation: [0, 0, 0, 1], Color: [0, 0, 0, 1] } } };
  const original = JSON.stringify(metadata), context = readNativeSketchRenderContext(metadata);
  expect(context.issues).toEqual([]);
  expect(context.fog).toEqual({ color: [31 / 255, 31 / 255, 78 / 255], density: 0 });
  expect(context.ambient).toEqual([64 / 255, 128 / 255, 1, 1]);
  expect(context.shadow!.orientation[0]).toBeCloseTo(-0.5);
  expect(context.shadow!.color).toEqual([32, 2, 0, 1]);
  context.shadow!.color[0] = 1;
  expect(JSON.stringify(metadata)).toBe(original);
});

it("retains valid overrides and reports malformed fields without turning them into invalid uniforms", () => {
  const context = readNativeSketchRenderContext({ Environment: { FogColor: [300, 0, 0, 255], FogDensity: -1 }, Lights: { Ambient: [NaN, 0, 0, 1], Shadow: { Orientation: [0, 0, 0, 0], Color: [1, 1, 1, 1] }, NoShadow: { Orientation: [0, 0, 0, 1], Color: [1, 2, 3, 1] } } });
  expect(context.fog).toBeUndefined(); expect(context.ambient).toBeUndefined(); expect(context.shadow).toBeUndefined();
  expect(context.noShadow!.color).toEqual([1, 2, 3, 1]); expect(context.issues).toHaveLength(3);
  expect(readNativeSketchRenderContext()).toEqual({ issues: [] });
});

it("keeps native, maintained-shader and metre-space fog exponents equal through scene scaling", () => {
  const density = 0.0025, nativeDistance = 20;
  for (const scale of [0.25, 1, 2, 10]) {
    const metres = nativeDistance * 0.1 * scale;
    expect(brushFogDensity(density, scale) * metres * 10).toBeCloseTo(density * nativeDistance);
    expect(sceneFogDensity(density, scale) * metres).toBeCloseTo(density * nativeDistance);
  }
  expect(brushFogDensity(0, 2)).toBe(0);
});
