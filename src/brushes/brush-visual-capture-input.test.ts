import { describe, expect, it } from "vitest";
import { opaqueCapturePixels, readUnityVisualCapture, resolveBrushCaptureSize } from "./brush-visual-capture-input.js";

function capture() {
  return {
    fixture: { schemaVersion: 1, brushGuid: "brush-guid", fixedShaderTimeSeconds: 0.5, strokes: [{ input: {
      brushGuid: "brush-guid", brushSize: 0.1125, brushScale: 1, color: [0.2, 0.2, 0.9, 1],
      seed: 123, flags: 0, localToWorldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      controlPoints: [{ position: [-1.25, 100, 4], orientation: [0.1, 0.2, 0.3, 0.9], pressure: 0.25, timestampMs: 17 }],
    } }] },
    capture: { brushGuid: "brush-guid", width: 2048, height: 2048, supersampling: 1, msaaSamples: 1,
      postProcessing: false, fixedShaderTimeSeconds: 0.5,
      camera: { position: [0, 100, 0], rotation: [0, 0, 0, 1], fieldOfView: 60, nearClip: 0.5, farClip: 10000, aspect: 1 } },
  };
}

describe("native visual-capture input", () => {
  it("converts units and handedness while preserving pressure, timing, seed and color", () => {
    const result = readUnityVisualCapture(capture(), "brush-guid");
    expect(result.stroke.controlPoints[0]).toEqual({ position: [-0.125, 10, -0.4], orientation: [-0.1, -0.2, 0.3, 0.9], pressure: 0.25, timestampMs: 17 });
    expect(result.stroke.brushSize).toBeCloseTo(0.01125);
    expect(result.stroke.seed).toBe(123);
    expect(result.stroke.color).toEqual([0.2, 0.2, 0.9, 1]);
    expect(result.camera.position).toEqual([0, 10, -0]);
    expect(result.camera.near).toBe(0.05);
    expect(result.camera.far).toBe(1000);
    expect(result.size).toBe(2048);
  });
  it("rejects a different brush or a mesh/image time mismatch", () => {
    expect(() => readUnityVisualCapture(capture(), "other-guid")).toThrow("does not match");
    const value = capture(); value.capture.fixedShaderTimeSeconds = 1;
    expect(() => readUnityVisualCapture(value, "brush-guid")).toThrow("shader times differ");
  });
  it("fails explicitly for unimplemented canvas transforms", () => {
    const value = capture(); value.fixture.strokes[0].input.localToWorldMatrix[12] = 2;
    expect(() => readUnityVisualCapture(value, "brush-guid")).toThrow("canvas transforms are not implemented");
  });
  it("rejects nonfinite input and mismatched antialiasing", () => {
    const value = capture(); value.fixture.strokes[0].input.controlPoints[0].pressure = NaN;
    expect(() => readUnityVisualCapture(value, "brush-guid")).toThrow("finite");
    const antialiasing = capture(); antialiasing.capture.msaaSamples = 4;
    expect(() => readUnityVisualCapture(antialiasing, "brush-guid")).toThrow("without supersampling, MSAA");
  });
  it("bounds capture allocation and retains the legacy default", () => {
    expect(resolveBrushCaptureSize(null)).toBe(1024);
    expect(resolveBrushCaptureSize("2048")).toBe(2048);
    expect(() => resolveBrushCaptureSize("8192")).toThrow("1024 or 2048");
  });
  it("flips readback rows and preserves RGB at zero alpha for native RGB24 comparison", () => {
    const source = new Uint8Array([1, 2, 3, 0, 4, 5, 6, 128, 7, 8, 9, 0, 10, 11, 12, 255]);
    expect([...opaqueCapturePixels(source, 2)]).toEqual([7, 8, 9, 255, 10, 11, 12, 255, 1, 2, 3, 255, 4, 5, 6, 255]);
    expect(source[3]).toBe(0);
    expect(() => opaqueCapturePixels(source, 1)).toThrow("dimensions");
  });
});
