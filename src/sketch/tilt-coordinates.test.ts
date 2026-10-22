import { describe, expect, it } from "vitest";
import { zipSync, unzipSync } from "three/examples/jsm/libs/fflate.module.js";
import { readTiltStrokeData } from "three-tiltloader";
import { createEmptyStrokeData, type StrokeData } from "../types.js";
import { createSketchDocument } from "./document.js";
import { readTiltFile, writeTiltFile, TILT_SENTINEL, TILT_HEADER_SIZE, TILT_HEADER_VERSION } from "./tilt-file.js";
import { writeSketchMemory } from "./sketch-memory.js";

const brush = "429ed64a-4e97-4466-84d3-145a861ef684";
const stroke = () => createEmptyStrokeData({
  brushGuid: brush, brushSize: 2, brushScale: 3, seed: -9, groupId: 7, layerIndex: 2,
  controlPoints: [{ position: [10, 20, 30], orientation: [0.5, 0.25, 0.125, 0.75], pressure: 0.5, timestampMs: 123 }],
});

// Build the file independently of the production archive writer/converters.
function inputFile(input: StrokeData, extension?: Record<string, unknown>, layers?: unknown[]): Uint8Array {
  const payload = writeSketchMemory([input]);
  const metadata = { BrushIndex: payload.brushGuids, ...(extension ? { OpenBrushIwSdk: extension } : {}), ...(layers ? { Layers: layers } : {}) };
  const zip = zipSync({ "data.sketch": payload.bytes, "metadata.json": new TextEncoder().encode(JSON.stringify(metadata)) }, { level: 0 });
  const bytes = new Uint8Array(TILT_HEADER_SIZE + zip.length), view = new DataView(bytes.buffer);
  view.setUint32(0, TILT_SENTINEL, true);
  view.setUint16(4, TILT_HEADER_SIZE, true);
  view.setUint16(6, TILT_HEADER_VERSION, true);
  bytes.set(zip, TILT_HEADER_SIZE);
  return bytes;
}

describe("tilt file coordinate boundary", () => {
  it("reads native decimetres and reflected poses as web metres exactly once", () => {
    const source = stroke(), result = readTiltFile(inputFile(source)).strokes[0];
    expect(result.brushSize).toBe(0.2);
    expect(result.controlPoints[0]).toEqual({ ...source.controlPoints[0], position: [1, 2, -3], orientation: [-0.5, -0.25, 0.125, 0.75] });
    expect([result.brushScale, result.seed, result.groupId, result.layerIndex]).toEqual([3, -9, 7, 2]);
  });

  it("writes native values independently readable by the shared binary parser", () => {
    const source = stroke(), bytes = writeTiltFile(createSketchDocument({ strokes: [source] }));
    const zip = unzipSync(bytes.subarray(TILT_HEADER_SIZE));
    const metadata = JSON.parse(new TextDecoder().decode(zip["metadata.json"]));
    expect(metadata.OpenBrushIwSdk.coordinateSpace).toBe("unity-decimeters");
    const raw = readTiltStrokeData(zip["data.sketch"], metadata.BrushIndex)[0];
    expect(raw.brushSize).toBe(20);
    expect(raw.controlPoints[0]).toEqual({ ...source.controlPoints[0], position: [100, 200, -300], orientation: [-0.5, -0.25, 0.125, 0.75] });
    expect(readTiltFile(bytes).strokes[0].controlPoints).toEqual(source.controlPoints);
  });

  it("keeps old unmarked web exports in metres while migrating their next save", () => {
    const source = stroke();
    const legacy = readTiltFile(inputFile(source, { appName: "Open Brush", schemaVersion: 1 }));
    expect(legacy.strokes[0].brushSize).toBe(source.brushSize);
    expect(legacy.strokes[0].controlPoints).toEqual(source.controlPoints);
    let document = legacy;
    for (let i = 0; i < 3; i++) document = readTiltFile(writeTiltFile(document));
    expect(document.strokes).toEqual(legacy.strokes);
  });

  it("rejects unknown coordinate markers instead of guessing a scale", () => {
    expect(() => readTiltFile(inputFile(stroke(), { coordinateSpace: "future-space" }))).toThrow("Unsupported Open Brush .tilt coordinate space");
  });

  it("reads native layer names/visibility and writes edits without discarding transforms", () => {
    const input = stroke(); input.layerIndex = 1;
    const transform = [[10, 20, 30], [0, 0, 0, 1], 2];
    const document = readTiltFile(inputFile(input, undefined, [
      { Name: "Backdrop", Visible: true },
      { Name: "Hidden", Visible: false, Transform: transform, Future: { keep: true } },
    ]));
    expect(document.layers).toEqual([
      { id: 0, name: "Backdrop", visible: true, locked: false },
      { id: 1, name: "Hidden", visible: false, locked: false, transform: { position: [1, 2, -3], rotation: [0, 0, 0, 1], scale: 2 } },
    ]);
    expect(document.strokes[0].controlPoints[0].position).toEqual([1, 2, -3]);
    document.layers[1].name = "Revised"; document.layers[1].visible = true;
    const zip = unzipSync(writeTiltFile(document).subarray(TILT_HEADER_SIZE));
    const metadata = JSON.parse(new TextDecoder().decode(zip["metadata.json"]));
    expect(metadata.Layers[1]).toEqual({ Name: "Revised", Visible: true, Transform: transform, Future: { keep: true } });
  });

  it("maps sparse app layer IDs to compact native slots and restores their IDs", () => {
    const source = stroke(); source.layerIndex = 2_000_000_000;
    const document = createSketchDocument({ layers: [
      { id: 4, name: "Empty", visible: true, locked: false },
      { id: source.layerIndex, name: "Ink", visible: false, locked: true },
    ], strokes: [source] });
    const bytes = writeTiltFile(document), zip = unzipSync(bytes.subarray(TILT_HEADER_SIZE));
    const metadata = JSON.parse(new TextDecoder().decode(zip["metadata.json"]));
    expect(metadata.Layers).toHaveLength(2);
    expect(metadata.OpenBrushIwSdk.nativeLayerIds).toEqual([4, 2_000_000_000]);
    expect(readTiltStrokeData(zip["data.sketch"], metadata.BrushIndex)[0].layerIndex).toBe(1);
    const result = readTiltFile(bytes);
    expect(result.layers).toEqual(document.layers);
    expect(result.strokes[0].layerIndex).toBe(source.layerIndex);
  });

  it("rejects ambiguous native layer maps", () => {
    expect(() => readTiltFile(inputFile(stroke(), { nativeLayerIds: [0, 0] }, [{}, {}]))).toThrow("Invalid native layer ID mapping");
  });
});
