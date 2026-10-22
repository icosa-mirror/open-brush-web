import { describe, expect, it } from "vitest";
import { encodeLayerContext, LayerContextReceiver, layerPosesCompatible, parseLayerContext } from "./layer-context.js";
import { parseCollabMessage, COLLAB_PROTOCOL_VERSION } from "./protocol.js";
import { createSketchLayer } from "../sketch/document.js";

const layer = () => createSketchLayer({ id: 4, name: "Posed", transform: { position: [1, 2, -3], rotation: [0, 0, 0, 1], scale: 2 } });

describe("shared layer context", () => {
  it("reassembles large Unicode names in wire-safe JSON frames before exposing layers", () => {
    const layers = [layer()]; layers[0].name = "😀\u0000\\\"".repeat(3000);
    const encoded = encodeLayerContext(layers), receiver = new LayerContextReceiver();
    receiver.begin(encoded.length);
    let result;
    for (const [index, chunk] of encoded.chunks.entries()) {
      const frame = { t: "layer-data", ...chunk };
      expect(new TextEncoder().encode(JSON.stringify(frame)).length).toBeLessThan(16 * 1024);
      expect(parseCollabMessage(frame)?.t).toBe("layer-data");
      result = receiver.push(chunk);
      if (index < encoded.chunks.length - 1) expect(result).toBeUndefined();
    }
    expect(result).toEqual(layers);
  });

  it("rejects gaps, overruns and malformed contexts without yielding partial definitions", () => {
    const receiver = new LayerContextReceiver(); receiver.begin(2);
    expect(() => receiver.push({ from: 1, data: "[]" })).toThrow("transfer");
    expect(() => receiver.push({ from: 0, data: "[{}]" })).toThrow("transfer");
    expect(() => receiver.push({ from: 0, data: "[]" })).toThrow("definitions");
    expect(parseLayerContext([layer(), layer()])).toBeUndefined();
    expect(parseLayerContext([{ ...layer(), transform: { position: [0, 0, NaN], rotation: [0, 0, 0, 1], scale: 1 } }])).toBeUndefined();
    expect(parseLayerContext([{ ...layer(), id: -1 }])).toBeUndefined();
  });

  it("keeps Float32 rotations stable over repeated context exchanges", () => {
    const layers = [layer()];
    layers[0].transform!.rotation = [0.5499787330627441, 0.49989476799964905, 0.1931496560573578, 0.6405637264251709];
    let next = layers;
    for (let i = 0; i < 5; i++) next = parseLayerContext(JSON.parse(JSON.stringify(next)))!;
    expect(next).toEqual(layers);
    expect(layerPosesCompatible(layers, next, [4])).toBe(true);
  });

  it("permits an empty guest to adopt host layers but protects existing stroke coordinates", () => {
    const local = [layer()], host = [layer()]; host[0].transform!.scale = 3;
    expect(layerPosesCompatible(local, host, [])).toBe(true);
    expect(layerPosesCompatible(local, host, [4])).toBe(false);
    expect(layerPosesCompatible(local, [], [4])).toBe(false);
    host[0].transform!.scale = 2; host[0].name = "Host name"; host[0].visible = false;
    expect(layerPosesCompatible(local, host, [4])).toBe(true);
  });

  it("requires context lengths for the current protocol while parsing older versions for explicit rejection", () => {
    const snapshot = { t: "snapshot", version: COLLAB_PROTOCOL_VERSION, sketchName: "Shared", strokeCount: 0 };
    expect(parseCollabMessage(snapshot)).toBeUndefined();
    expect(parseCollabMessage({ ...snapshot, layerDataLength: 2 })?.t).toBe("snapshot");
    expect(parseCollabMessage({ ...snapshot, version: COLLAB_PROTOCOL_VERSION - 1 })?.t).toBe("snapshot");
  });
});
