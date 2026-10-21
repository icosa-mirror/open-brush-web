import { createEmptyStrokeData, type Quat, type Rgba, type Vec3 } from "../types.js";
import { UNITS_TO_METERS } from "../sketch/tilt-brush-units.js";

export const DEFAULT_BRUSH_CAPTURE_SIZE = 1024;

export function resolveBrushCaptureSize(value: string | null): number {
  if (value === null) return DEFAULT_BRUSH_CAPTURE_SIZE;
  if (value !== "1024" && value !== "2048") throw new Error("Brush capture size must be 1024 or 2048.");
  return Number(value);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a native capture object.");
  return value as Record<string, unknown>;
}

function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Native capture numbers must be finite.");
  return value;
}

function tuple(value: unknown, length: number): number[] {
  if (!Array.isArray(value) || value.length !== length) throw new Error(`Expected a ${length}-component native capture vector.`);
  return value.map(number);
}

function position(value: unknown): Vec3 {
  const [x, y, z] = tuple(value, 3);
  return [x * UNITS_TO_METERS, y * UNITS_TO_METERS, -z * UNITS_TO_METERS];
}

function rotation(value: unknown): Quat {
  const [x, y, z, w] = tuple(value, 4);
  return [-x, -y, z, w];
}

/** Same unit/handedness conversion as the live-mesh comparator; never reshape a brush's inputs. */
export function readUnityVisualCapture(value: unknown, requestedGuid: string) {
  const payload = object(value);
  const fixture = object(payload.fixture);
  const capture = object(payload.capture);
  if (fixture.schemaVersion !== 1 || typeof fixture.brushGuid !== "string" ||
    fixture.brushGuid.toLowerCase() !== requestedGuid.toLowerCase() ||
    capture.brushGuid !== fixture.brushGuid) throw new Error("Native capture brush/schema does not match the requested brush.");
  if (!Array.isArray(fixture.strokes) || fixture.strokes.length !== 1) throw new Error("Visual capture requires exactly one native stroke.");
  const input = object(object(fixture.strokes[0]).input);
  if (input.brushGuid !== fixture.brushGuid) throw new Error("Native stroke GUID does not match its fixture.");
  const transform = tuple(input.localToWorldMatrix, 16);
  if (transform.some((v, i) => Math.abs(v - (i % 5 === 0 ? 1 : 0)) > 1e-6)) {
    throw new Error("Non-identity native canvas transforms are not implemented in the capture adapter.");
  }
  const size = resolveBrushCaptureSize(String(capture.width));
  if (capture.height !== size || capture.supersampling !== 1 || capture.msaaSamples !== 1 || capture.postProcessing !== false) {
    throw new Error("Native capture must be square, without supersampling, MSAA, or post-processing.");
  }
  if (!Array.isArray(input.controlPoints) || input.controlPoints.length === 0) throw new Error("Native capture has no control points.");
  const camera = object(capture.camera);
  const fieldOfView = number(camera.fieldOfView);
  const near = number(camera.nearClip) * UNITS_TO_METERS;
  const far = number(camera.farClip) * UNITS_TO_METERS;
  if (fieldOfView <= 0 || fieldOfView >= 180 || near <= 0 || far <= near || camera.aspect !== 1) throw new Error("Invalid native camera projection.");
  const shaderTimeSeconds = number(fixture.fixedShaderTimeSeconds);
  if (capture.fixedShaderTimeSeconds !== shaderTimeSeconds) throw new Error("Native mesh and image shader times differ.");
  return {
    size, shaderTimeSeconds,
    camera: { position: position(camera.position), rotation: rotation(camera.rotation), fieldOfView, near, far },
    stroke: createEmptyStrokeData({
      guid: "native-visual-capture", brushGuid: fixture.brushGuid,
      brushSize: number(input.brushSize) * UNITS_TO_METERS,
      brushScale: number(input.brushScale), color: tuple(input.color, 4) as Rgba,
      seed: number(input.seed), flags: number(input.flags),
      controlPoints: input.controlPoints.map((value) => {
        const point = object(value);
        return { position: position(point.position), orientation: rotation(point.orientation),
          pressure: number(point.pressure), timestampMs: number(point.timestampMs) };
      }),
    }),
  };
}

/** Native PNGs use RGB24. Preserve readback RGB, even when render-target alpha is zero. */
export function opaqueCapturePixels(pixels: Uint8Array, size: number): Uint8ClampedArray<ArrayBuffer> {
  if (pixels.length !== size * size * 4) throw new Error("Capture pixels do not match their dimensions.");
  const result = new Uint8ClampedArray(pixels.length);
  const rowBytes = size * 4;
  for (let y = 0; y < size; y++) {
    result.set(pixels.subarray(y * rowBytes, (y + 1) * rowBytes), (size - y - 1) * rowBytes);
  }
  for (let i = 3; i < result.length; i += 4) result[i] = 255;
  return result;
}
