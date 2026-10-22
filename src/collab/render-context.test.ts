import { expect, it } from "vitest";
import { parseSharedRenderMetadata, sameSharedRenderMetadata, selectSharedRenderMetadata } from "./render-context.js";
import { encodeSketchContext, SketchContextReceiver } from "./layer-context.js";
import { createSketchLayer } from "../sketch/document.js";

const native = () => ({ EnvironmentPreset: "native-preset", Environment: { FogColor: [31, 31, 78, 255], FogDensity: 0, ReflectionIntensity: 0.4 },
  Lights: { Ambient: [172, 172, 173, 255], Shadow: { Orientation: [0, 0, 0, -2], Color: [32, 2, 1, 1] }, NoShadow: { Orientation: [0, 0, 0, 1], Color: [0, 0, 0, 1] } }, ArchiveMarker: "not-shared" });

it("transfers supported native encodings without aliasing or sharing opaque archive fields", () => {
  const source = native(), original = JSON.stringify(source), selected = selectSharedRenderMetadata(source);
  expect(selected.Environment).toEqual({ FogColor: [31, 31, 78, 255], FogDensity: 0 });
  expect(selected.Lights!.Shadow.Orientation).toEqual([0, 0, 0, -2]);
  expect(selected.ArchiveMarker).toBeUndefined();
  const layers = [createSketchLayer({ id: 0, name: "Main" })], encoded = encodeSketchContext(layers, selected), receiver = new SketchContextReceiver();
  receiver.begin(encoded.length);
  let received;
  for (const chunk of encoded.chunks) received = receiver.push(chunk);
  expect(received).toEqual({ layers, renderMetadata: selected });
  received!.renderMetadata.Lights!.Shadow.Color[0] = 1;
  expect(JSON.stringify(source)).toBe(original);
});

it("rejects malformed render settings before releasing an otherwise valid layer context", () => {
  expect(parseSharedRenderMetadata(null)).toBeUndefined();
  expect(parseSharedRenderMetadata({ Environment: { FogColor: [0, 0, 0, 255], FogDensity: -1 } })).toBeUndefined();
  for (const renderMetadata of [undefined, { Lights: { Ambient: [0, 0, 0, 255] } }]) {
    const text = JSON.stringify({ layers: [createSketchLayer({ id: 0, name: "Main" })], renderMetadata });
    const receiver = new SketchContextReceiver(); receiver.begin(text.length);
    expect(() => receiver.push({ from: 0, data: text })).toThrow("definitions");
  }
});

it("compares canonical supported host settings and distinguishes explicit zero from default", () => {
  const a = selectSharedRenderMetadata(native()), b = structuredClone(a);
  expect(sameSharedRenderMetadata(a, b)).toBe(true);
  b.Environment!.FogDensity = 0.01;
  expect(sameSharedRenderMetadata(a, b)).toBe(false);
  expect(sameSharedRenderMetadata(a, {})).toBe(false);
  expect(parseSharedRenderMetadata({})).toEqual({});
});
