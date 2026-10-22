import {
  createSketchDocument,
  createSketchLayer,
  type SketchDocument,
  type SketchLayer,
  type SketchMediaReference,
  type SketchMetadata,
} from "./document.js";
import { normalizeGuid } from "./binary.js";
import { readSketchMemory, writeSketchMemory } from "./sketch-memory.js";
import { nativeTiltStrokeToWeb, webStrokeToNativeTilt } from "./tilt-brush-units.js";
import { nativeLayerTransformToWeb, readWebLayerTransform, sameLayerTransform, webLayerTransformToNative } from "./layer-transform.js";

export const TILT_SENTINEL = 0x546c6974;
export const TILT_HEADER_SIZE = 16;
export const TILT_HEADER_VERSION = 1;

export const TILT_METADATA_ENTRY = "metadata.json";
export const TILT_SKETCH_ENTRY = "data.sketch";
export const TILT_THUMBNAIL_ENTRY = "thumbnail.png";
export const TILT_HIRES_ENTRY = "hires.png";

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_VERSION_STORED = 20;

export interface TiltFileWriteOptions {
  thumbnailPng?: Uint8Array;
  hiresPng?: Uint8Array;
}

export interface TiltFileMetadata {
  BrushIndex: string[];
  Layers?: Array<{ Name?: string; Visible?: boolean; [key: string]: unknown }>;
  OpenBrushIwSdk?: {
    coordinateSpace?: "unity-decimeters" | "web-meters";
    nativeLayerIds?: number[];
    appName: string;
    schemaVersion: number;
    source: SketchMetadata["source"];
    layers: SketchLayer[];
    media?: SketchMediaReference[];
  };
}

interface ZipEntryPayload {
  name: string;
  bytes: Uint8Array;
  crc32: number;
  localHeaderOffset: number;
}

export function writeTiltFile(
  document: SketchDocument,
  options: TiltFileWriteOptions = {},
): Uint8Array {
  const preservedMetadata = structuredClone(document.tiltArchive?.metadata ?? {}) as Partial<TiltFileMetadata>;
  const nativeLayers = prepareNativeLayers(document.layers, document.strokes.map(stroke => stroke.layerIndex), preservedMetadata);
  const sketchPayload = writeSketchMemory(document.strokes.map(stroke => ({
    ...webStrokeToNativeTilt(stroke), layerIndex: nativeLayers.indexById.get(stroke.layerIndex)!,
  })), preservedMetadata.BrushIndex);
  const metadata: TiltFileMetadata = {
    ...preservedMetadata,
    BrushIndex: sketchPayload.brushGuids.map(normalizeGuid),
    Layers: nativeLayers.layers,
    OpenBrushIwSdk: {
      ...preservedMetadata.OpenBrushIwSdk,
      coordinateSpace: "unity-decimeters",
      nativeLayerIds: nativeLayers.ids,
      appName: document.metadata.appName,
      schemaVersion: document.metadata.schemaVersion,
      source: document.metadata.source,
      layers: document.layers.map((layer) => ({ ...layer })),
      media: document.media.map((media) => ({
        ...media,
        transform: {
          position: [...media.transform.position],
          rotation: [...media.transform.rotation],
          scale: [...media.transform.scale],
        },
      })),
    },
  };
  const entries = new Map(document.tiltArchive?.entries.map(entry => [entry.name, entry.bytes]));
  entries.set(TILT_SKETCH_ENTRY, sketchPayload.bytes);
  entries.set(TILT_METADATA_ENTRY, encodeJson(metadata));
  entries.set(TILT_THUMBNAIL_ENTRY, options.thumbnailPng ?? entries.get(TILT_THUMBNAIL_ENTRY) ?? DEFAULT_THUMBNAIL_PNG);
  if (options.hiresPng) {
    entries.set(TILT_HIRES_ENTRY, options.hiresPng);
  }

  const zipBytes = writeStoredZip(Array.from(entries, ([name, bytes]) => ({ name, bytes })));
  const writer = new BinaryByteWriter();
  writer.writeUint32(TILT_SENTINEL);
  writer.writeUint16(TILT_HEADER_SIZE);
  writer.writeUint16(TILT_HEADER_VERSION);
  writer.writeUint32(0);
  writer.writeUint32(0);
  writer.writeBytes(zipBytes);
  return writer.toUint8Array();
}

export function readTiltFile(bytes: Uint8Array): SketchDocument {
  const entries = readStoredZip(bytes);
  const metadataBytes = entries.get(TILT_METADATA_ENTRY);
  const sketchBytes = entries.get(TILT_SKETCH_ENTRY);
  if (!metadataBytes) {
    throw new Error("Invalid Open Brush .tilt: missing metadata.json");
  }
  if (!sketchBytes) {
    throw new Error("Invalid Open Brush .tilt: missing data.sketch");
  }

  const metadata = decodeJson<TiltFileMetadata>(metadataBytes);
  const brushGuids = readBrushIndex(metadata);
  const coordinateSpace = metadata.OpenBrushIwSdk?.coordinateSpace;
  if (coordinateSpace !== undefined && coordinateSpace !== "unity-decimeters" && coordinateSpace !== "web-meters") {
    throw new Error(`Unsupported Open Brush .tilt coordinate space: ${coordinateSpace}`);
  }
  // Earlier web exports had no convention marker and wrote web metres directly.
  const nativeCoordinates = !metadata.OpenBrushIwSdk || coordinateSpace === "unity-decimeters";
  const rawStrokes = readSketchMemory(sketchBytes, brushGuids);
  const nativeLayerIds = readNativeLayerIds(metadata);
  if (nativeLayerIds) {
    for (const stroke of rawStrokes) {
      const layerId = nativeLayerIds[stroke.layerIndex];
      if (layerId === undefined) throw new Error("Stroke refers to a missing native layer slot.");
      stroke.layerIndex = layerId;
    }
  }
  const strokes = nativeCoordinates ? rawStrokes.map(nativeTiltStrokeToWeb) : rawStrokes;
  const layers = readLayers(metadata, strokes.map((stroke) => stroke.layerIndex));
  const media = readMedia(metadata);
  return createSketchDocument({
    metadata: {
      appName:
        metadata.OpenBrushIwSdk?.appName ?? "Open Brush",
      schemaVersion: metadata.OpenBrushIwSdk?.schemaVersion ?? 1,
      source: "tilt",
    },
    layers,
    media,
    strokes,
    tiltArchive: {
      metadata: metadata as unknown as Record<string, unknown>,
      entries: Array.from(entries, ([name, bytes]) => ({ name, bytes }))
        .filter(entry => entry.name !== TILT_METADATA_ENTRY && entry.name !== TILT_SKETCH_ENTRY),
    },
  });
}

export function listTiltFileEntries(bytes: Uint8Array): string[] {
  return Array.from(readStoredZip(bytes).keys()).sort();
}

function readBrushIndex(metadata: TiltFileMetadata): string[] {
  if (!Array.isArray(metadata.BrushIndex)) {
    throw new Error("Invalid Open Brush .tilt metadata: BrushIndex missing");
  }
  return metadata.BrushIndex.map(normalizeGuid);
}

function readMedia(metadata: TiltFileMetadata): SketchMediaReference[] {
  const media = metadata.OpenBrushIwSdk?.media;
  if (!Array.isArray(media)) {
    return [];
  }
  return media.map((reference) => ({
    id: String(reference.id),
    kind: reference.kind === "model" ? "model" : "image",
    mediaPath: String(reference.mediaPath),
    originalName: String(reference.originalName),
    mimeType: String(reference.mimeType),
    byteLength: Number(reference.byteLength),
    transform: {
      position: readNumberTuple(reference.transform?.position, [0, 1, -1]),
      rotation: readNumberTuple(reference.transform?.rotation, [0, 0, 0, 1]),
      scale: readNumberTuple(reference.transform?.scale, [1, 1, 1]),
    },
  }));
}

function readNumberTuple<T extends number[]>(
  value: unknown,
  fallback: T,
): T {
  if (!Array.isArray(value)) {
    return [...fallback] as T;
  }
  return fallback.map((fallbackValue, index) => {
    const numberValue = Number(value[index]);
    return Number.isFinite(numberValue) ? numberValue : fallbackValue;
  }) as T;
}

function readNativeLayerIds(metadata: Partial<TiltFileMetadata>): number[] | undefined {
  const ids = metadata.OpenBrushIwSdk?.nativeLayerIds;
  if (ids === undefined) return undefined;
  if (!Array.isArray(ids) || ids.length !== metadata.Layers?.length || new Set(ids).size !== ids.length || ids.some(id => !Number.isSafeInteger(id) || id < 0 || id > 0x7fffffff)) {
    throw new Error("Invalid native layer ID mapping.");
  }
  return ids;
}

function prepareNativeLayers(layers: readonly SketchLayer[], strokeLayers: readonly number[], metadata: Partial<TiltFileMetadata>) {
  const result = structuredClone(metadata.Layers ?? []);
  const ids = [...(readNativeLayerIds(metadata) ?? result.map((_, index) => index))];
  const indexById = new Map(ids.map((id, index) => [id, index]));
  const ensureSlot = (id: number) => {
    if (!Number.isSafeInteger(id) || id < 0 || id > 0x7fffffff) throw new Error("Invalid sketch layer index.");
    let index = indexById.get(id);
    if (index === undefined) {
      index = result.length;
      indexById.set(id, index);
      ids.push(id);
      result.push({ Name: `Layer ${id + 1}`, Visible: true, Transform: [[0, 0, 0], [0, 0, 0, 1], 1] });
    }
    return index;
  };
  for (const layer of layers) {
    const index = ensureSlot(layer.id);
    if (layer.transform && !sameLayerTransform(layer.transform, nativeLayerTransformToWeb(result[index].Transform))) {
      result[index].Transform = webLayerTransformToNative(layer.transform);
    }
    result[index] = { ...result[index], Name: layer.name, Visible: layer.visible };
  }
  for (const id of strokeLayers) ensureSlot(id);
  return { layers: result, ids, indexById };
}

function readLayers(
  metadata: TiltFileMetadata,
  strokeLayerIndexes: readonly number[],
): SketchLayer[] {
  const layers = metadata.OpenBrushIwSdk?.layers;
  if (Array.isArray(layers) && layers.length > 0) {
    return layers.map((layer) =>
      createSketchLayer({
        id: Number(layer.id),
        name: String(layer.name),
        visible: Boolean(layer.visible),
        locked: Boolean(layer.locked),
        transform: readWebLayerTransform(layer.transform) ?? nativeLayerTransformToWeb(metadata.Layers?.[readNativeLayerIds(metadata)?.indexOf(Number(layer.id)) ?? Number(layer.id)]?.Transform),
      }),
    );
  }

  if (Array.isArray(metadata.Layers) && metadata.Layers.length > 0) {
    const ids = readNativeLayerIds(metadata);
    const nativeLayers = metadata.Layers.map((layer, index) => createSketchLayer({
      id: ids?.[index] ?? index,
      name: typeof layer.Name === "string" ? layer.Name : `Layer ${index + 1}`,
      visible: layer.Visible === true,
      transform: nativeLayerTransformToWeb(layer.Transform),
    }));
    for (const id of new Set(strokeLayerIndexes)) {
      if (!nativeLayers.some(layer => layer.id === id)) nativeLayers.push(createSketchLayer({ id, name: `Layer ${id + 1}` }));
    }
    return nativeLayers;
  }

  const layerIds = Array.from(new Set(strokeLayerIndexes)).sort((a, b) => a - b);
  if (layerIds.length === 0) {
    layerIds.push(0);
  }
  return layerIds.map((id) =>
    createSketchLayer({
      id,
      name: id === 0 ? "Layer 1" : `Layer ${id}`,
    }),
  );
}

function writeStoredZip(
  entries: Array<{ name: string; bytes: Uint8Array }>,
): Uint8Array {
  const writer = new BinaryByteWriter();
  const payloads: ZipEntryPayload[] = [];
  for (const entry of entries) {
    const nameBytes = encodeAscii(entry.name);
    const crc32 = computeCrc32(entry.bytes);
    const localHeaderOffset = writer.byteLength;
    writer.writeUint32(ZIP_LOCAL_FILE_HEADER);
    writer.writeUint16(ZIP_VERSION_STORED);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint32(crc32);
    writer.writeUint32(entry.bytes.byteLength);
    writer.writeUint32(entry.bytes.byteLength);
    writer.writeUint16(nameBytes.byteLength);
    writer.writeUint16(0);
    writer.writeBytes(nameBytes);
    writer.writeBytes(entry.bytes);
    payloads.push({
      name: entry.name,
      bytes: entry.bytes,
      crc32,
      localHeaderOffset,
    });
  }

  const centralDirectoryOffset = writer.byteLength;
  for (const entry of payloads) {
    const nameBytes = encodeAscii(entry.name);
    writer.writeUint32(ZIP_CENTRAL_DIRECTORY_HEADER);
    writer.writeUint16(ZIP_VERSION_STORED);
    writer.writeUint16(ZIP_VERSION_STORED);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint32(entry.crc32);
    writer.writeUint32(entry.bytes.byteLength);
    writer.writeUint32(entry.bytes.byteLength);
    writer.writeUint16(nameBytes.byteLength);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint16(0);
    writer.writeUint32(0);
    writer.writeUint32(entry.localHeaderOffset);
    writer.writeBytes(nameBytes);
  }
  const centralDirectorySize = writer.byteLength - centralDirectoryOffset;

  writer.writeUint32(ZIP_END_OF_CENTRAL_DIRECTORY);
  writer.writeUint16(0);
  writer.writeUint16(0);
  writer.writeUint16(payloads.length);
  writer.writeUint16(payloads.length);
  writer.writeUint32(centralDirectorySize);
  writer.writeUint32(centralDirectoryOffset);
  writer.writeUint16(0);
  return writer.toUint8Array();
}

function readStoredZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const zipStart = getZipStartOffset(bytes);
  const view = dataView(bytes);
  const eocdOffset = findEndOfCentralDirectory(bytes, zipStart);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  let cursor = zipStart + centralDirectoryOffset;
  const entries = new Map<string, Uint8Array>();

  for (let index = 0; index < entryCount; index += 1) {
    requireSignature(view, cursor, ZIP_CENTRAL_DIRECTORY_HEADER);
    const compressionMethod = view.getUint16(cursor + 10, true);
    if (compressionMethod !== 0) {
      throw new Error(
        `Unsupported Open Brush .tilt zip compression method: ${compressionMethod}`,
      );
    }
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    if (compressedSize !== uncompressedSize) {
      throw new Error("Invalid Open Brush .tilt zip: compressed size mismatch");
    }
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const name = decodeUtf8(
      sliceBytes(bytes, cursor + 46, cursor + 46 + nameLength),
    );
    const localOffset = zipStart + localHeaderOffset;
    requireSignature(view, localOffset, ZIP_LOCAL_FILE_HEADER);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    entries.set(name, sliceBytes(bytes, dataOffset, dataOffset + compressedSize));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function getZipStartOffset(bytes: Uint8Array): number {
  const view = dataView(bytes);
  const firstWord = view.getUint32(0, true);
  if (firstWord === ZIP_LOCAL_FILE_HEADER) {
    return 0;
  }
  if (firstWord !== TILT_SENTINEL) {
    throw new Error("Invalid Open Brush .tilt: bad tilt header sentinel");
  }
  const headerSize = view.getUint16(4, true);
  const headerVersion = view.getUint16(6, true);
  if (headerVersion !== TILT_HEADER_VERSION) {
    throw new Error(`Unsupported Open Brush .tilt header version: ${headerVersion}`);
  }
  if (headerSize < TILT_HEADER_SIZE) {
    throw new Error(`Invalid Open Brush .tilt header size: ${headerSize}`);
  }
  requireSignature(view, headerSize, ZIP_LOCAL_FILE_HEADER);
  return headerSize;
}

function findEndOfCentralDirectory(bytes: Uint8Array, zipStart: number): number {
  const view = dataView(bytes);
  for (let offset = bytes.byteLength - 22; offset >= zipStart; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  throw new Error("Invalid Open Brush .tilt zip: missing central directory");
}

function requireSignature(view: DataView, offset: number, signature: number): void {
  if (offset < 0 || offset + 4 > view.byteLength) {
    throw new Error("Invalid Open Brush .tilt zip: read past end");
  }
  const actual = view.getUint32(offset, true);
  if (actual !== signature) {
    throw new Error(`Invalid Open Brush .tilt zip signature: 0x${actual.toString(16)}`);
  }
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeJson<T>(bytes: Uint8Array): T {
  return JSON.parse(decodeUtf8(bytes)) as T;
}

function encodeAscii(value: string): Uint8Array {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0x7f) {
      throw new Error(`ZIP entry name must be ASCII: ${value}`);
    }
  }
  return new TextEncoder().encode(value);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function sliceBytes(bytes: Uint8Array, start: number, end: number): Uint8Array {
  if (start < 0 || end < start || end > bytes.byteLength) {
    throw new Error("Invalid Open Brush .tilt zip: entry range is out of bounds");
  }
  return new Uint8Array(bytes.slice(start, end));
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

class BinaryByteWriter {
  private bytes: number[] = [];

  get byteLength(): number {
    return this.bytes.length;
  }

  writeUint16(value: number): void {
    this.bytes.push(value & 0xff, (value >>> 8) & 0xff);
  }

  writeUint32(value: number): void {
    this.bytes.push(
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff,
    );
  }

  writeBytes(bytes: Uint8Array): void {
    for (const byte of bytes) {
      this.bytes.push(byte);
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

const CRC32_TABLE = createCrc32Table();

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const DEFAULT_THUMBNAIL_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
  120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 42, 180, 0, 0, 0, 0, 73, 69,
  78, 68, 174, 66, 96, 130,
]);
