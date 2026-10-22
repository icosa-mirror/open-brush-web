import { describe, expect, it } from "vitest";
import { unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { readTiltStrokeData } from "three-tiltloader";
import { nativeLayerTransformToWeb, readWebLayerTransform, sameLayerTransform, webLayerTransformToNative } from "./layer-transform.js";
import { createSketchDocument, createSketchLayer } from "./document.js";
import { createEmptyStrokeData } from "../types.js";
import { readTiltFile, writeTiltFile, TILT_HEADER_SIZE } from "./tilt-file.js";

describe("native layer pose contract", () => {
  it("converts translation and rotation basis separately from dimensionless scale", () => {
    const pose = nativeLayerTransformToWeb([[10, 20, 30], [0.5, 0.5, 0.5, 0.5], 2]);
    expect(pose).toEqual({ position: [1, 2, -3], rotation: [-0.5, -0.5, 0.5, 0.5], scale: 2 });
    expect(webLayerTransformToNative(pose!)).toEqual([[10, 20, 30], [0.5, 0.5, 0.5, 0.5], 2]);
  });

  it("matches native legacy zero-scale, absolute scale and canvas limits", () => {
    expect(nativeLayerTransformToWeb([[0, 0, 0], [0, 0, 0, 1], 0])).toBeUndefined();
    expect(nativeLayerTransformToWeb([[0, 0, 0], [0, 0, 0, 1], -2])?.scale).toBe(2);
    expect(nativeLayerTransformToWeb([[0, 0, 0], [0, 0, 0, 1], 1e8])?.scale).toBe(1e4);
    expect(nativeLayerTransformToWeb([[0, 0, 0], [0, 0, 0, 1], 1e-8])?.scale).toBe(1e-4);
    expect(nativeLayerTransformToWeb(undefined)).toBeUndefined();
  });

  it("rejects invalid pose data before it reaches document/runtime state", () => {
    expect(() => nativeLayerTransformToWeb([[NaN, 0, 0], [0, 0, 0, 1], 1])).toThrow("tuple");
    expect(() => nativeLayerTransformToWeb([[0, 0, 0], [0, 0, 0, 0], 1])).toThrow("nonzero");
    expect(() => nativeLayerTransformToWeb([[0, 0, 0], [1e308, 1e308, 1e308, 1e308], 1])).toThrow("finite");
    expect(() => readWebLayerTransform({ position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: 0 })).toThrow("positive");
  });

  it("keeps layer-local stroke data separate and writes edited native poses", () => {
    const original = [[10, 20, 30], [0.1, 0.2, 0.3, 0.9], 2];
    const document = createSketchDocument({
      layers: [createSketchLayer({ id: 0, name: "Posed", transform: nativeLayerTransformToWeb(original) })],
      strokes: [createEmptyStrokeData({ brushGuid: "429ed64a-4e97-4466-84d3-145a861ef684", brushSize: 0.2,
        controlPoints: [{ position: [1, 2, -3], orientation: [0, 0, 0, 1], pressure: 0.5, timestampMs: 7 }] })],
      tiltArchive: { metadata: { Layers: [{ Name: "Posed", Visible: true, Transform: original, Future: "retain" }] }, entries: [] },
    });
    const first = writeTiltFile(document);
    let zip = unzipSync(first.subarray(TILT_HEADER_SIZE));
    expect(JSON.parse(new TextDecoder().decode(zip["metadata.json"])).Layers[0].Transform).toEqual(original);
    const parsed = readTiltFile(first);
    expect(parsed.strokes[0].controlPoints[0].position).toEqual([1, 2, -3]);
    expect(sameLayerTransform(parsed.layers[0].transform, document.layers[0].transform)).toBe(true);
    parsed.layers[0].transform = { position: [5, 6, -7], rotation: [0, 0, 0, 1], scale: 3 };
    zip = unzipSync(writeTiltFile(parsed).subarray(TILT_HEADER_SIZE));
    const metadata = JSON.parse(new TextDecoder().decode(zip["metadata.json"]));
    expect(metadata.Layers[0]).toEqual({ Name: "Posed", Visible: true, Future: "retain", Transform: [[50, 60, 70], [0, 0, 0, 1], 3] });
    const raw = readTiltStrokeData(zip["data.sketch"], metadata.BrushIndex)[0];
    expect(raw.controlPoints[0].position).toEqual([10, 20, 30]);
    expect(raw.brushSize).toBe(2);
  });

  it("copies layer poses when constructing a document snapshot", () => {
    const layer = createSketchLayer({ id: 0, name: "Original", transform: { position: [1, 2, 3], rotation: [0, 0, 0, 1], scale: 2 } });
    const copied = createSketchDocument({ layers: [layer] });
    copied.layers[0].transform!.position[0] = 99;
    expect(layer.transform!.position[0]).toBe(1);
  });
});
