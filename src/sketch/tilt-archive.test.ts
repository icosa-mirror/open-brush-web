import { describe, expect, it } from "vitest";
import { createSketchDocument, createSketchLayer, type TiltArchiveData } from "./document.js";
import { readTiltFile, writeTiltFile } from "./tilt-file.js";
import { convertTiltBrushUnitsToMeters } from "./tilt-brush-units.js";
import { createEmptyStrokeData } from "../types.js";
import { MemorySketchCatalogStore, createSketchCatalogRecord } from "./sketch-catalog.js";
import { SketchPersistenceController } from "./sketch-persistence.js";

const brush = "429ed64a-4e97-4466-84d3-145a861ef684";
const unusedBrush = "2241cd32-8ba2-48a5-9ee7-2caef7e9ed62";
function nativeDocument() {
  return createSketchDocument({
    layers: [createSketchLayer({ id: 0, name: "Native layer" })],
    strokes: [createEmptyStrokeData({ brushGuid: brush, brushSize: 2 })],
    tiltArchive: {
      metadata: {
        BrushIndex: [unusedBrush, brush],
        Environment: { Preset: "native", Exposure: 0.5 },
        Layers: [{ Id: 0, Name: "Native layer", Visible: true }],
        CameraPaths: [{ Name: "Path", Points: [[1, 2, 3]] }],
        FutureExtension: { Nested: [false, null, 17] },
        OpenBrushIwSdk: { futureField: "retain" },
      },
      entries: [
        { name: "thumbnail.png", bytes: new Uint8Array([1, 2, 3]) },
        { name: "hires.png", bytes: new Uint8Array([4, 5, 6]) },
        { name: "media/reference.bin", bytes: new Uint8Array([7, 8, 9]) },
      ],
    },
  });
}
const entry = (archive: TiltArchiveData | undefined, name: string) => archive?.entries.find(entry => entry.name === name)?.bytes;

describe("native archive preservation", () => {
  it("retains unknown metadata/assets and original brush indices when adding a brush", () => {
    const document = readTiltFile(writeTiltFile(nativeDocument()));
    const added = "89d104cd-d012-426b-b5b3-bbaee63ac43c";
    document.strokes.push(createEmptyStrokeData({ brushGuid: added, seed: -7 }));
    const saved = readTiltFile(writeTiltFile(document));
    expect(saved.tiltArchive?.metadata).toMatchObject({
      ...nativeDocument().tiltArchive?.metadata,
      BrushIndex: [unusedBrush, brush, added],
    });
    expect(saved.strokes.map(stroke => stroke.brushGuid)).toEqual([brush, added]);
    expect(saved.strokes[1].seed).toBe(-7);
    for (const asset of nativeDocument().tiltArchive!.entries) expect(entry(saved.tiltArchive, asset.name)).toEqual(asset.bytes);
  });

  it("replaces only explicitly supplied previews and keeps catalog thumbnails consistent", () => {
    const document = nativeDocument();
    const original = createSketchCatalogRecord({ id: "a", name: "A", document, nowMs: 1 });
    expect(original.thumbnailPng).toEqual(new Uint8Array([1, 2, 3]));
    const replacement = new Uint8Array([11, 12]);
    const record = createSketchCatalogRecord({ id: "b", name: "B", document, nowMs: 2, tiltOptions: { thumbnailPng: replacement } });
    const parsed = readTiltFile(record.tiltBytes);
    expect(record.thumbnailPng).toEqual(replacement);
    expect(entry(parsed.tiltArchive, "thumbnail.png")).toEqual(replacement);
    expect(entry(parsed.tiltArchive, "hires.png")).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("copies retained data across document construction and unit conversion", () => {
    const source = nativeDocument();
    const converted = convertTiltBrushUnitsToMeters(source);
    converted.tiltArchive!.metadata.Environment = "changed";
    entry(converted.tiltArchive, "thumbnail.png")![0] = 99;
    expect(source.tiltArchive!.metadata.Environment).toEqual({ Preset: "native", Exposure: 0.5 });
    expect(entry(source.tiltArchive, "thumbnail.png")![0]).toBe(1);
    expect(converted.strokes[0].brushSize).toBe(0.2);
    expect(converted.tiltArchive?.metadata.CameraPaths).toEqual(source.tiltArchive?.metadata.CameraPaths);
  });

  it("keeps imported native fields through edited persistence, save-as and reload", async () => {
    const controller = new SketchPersistenceController(new MemorySketchCatalogStore());
    const original = nativeDocument();
    original.layers[0].transform = { position: [1, 2, 3], rotation: [0, 0, 0, 1], scale: 2 };
    await controller.importTilt({ id: "native", name: "Native", tiltBytes: writeTiltFile(original) });
    const edited = controller.document;
    edited.strokes[0].brushSize = 3;
    controller.markDirty(edited);
    edited.tiltArchive!.metadata.Environment = "outside mutation";
    edited.layers[0].transform!.position[0] = 99;
    await controller.saveAs({ id: "copy", name: "Copy" });
    await controller.load("copy");
    const result = readTiltFile((await controller.exportTilt()).bytes);
    expect(result.strokes[0].brushSize).toBe(3);
    expect(result.layers[0].transform).toEqual(original.layers[0].transform);
    expect(result.tiltArchive?.metadata.Environment).toEqual({ Preset: "native", Exposure: 0.5 });
    expect(result.tiltArchive?.metadata.FutureExtension).toEqual({ Nested: [false, null, 17] });
    expect(entry(result.tiltArchive, "thumbnail.png")).toEqual(new Uint8Array([1, 2, 3]));
    expect(entry(result.tiltArchive, "media/reference.bin")).toEqual(new Uint8Array([7, 8, 9]));
  });
});
