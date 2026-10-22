import { createSketchLayer, type SketchLayer } from "../sketch/document.js";
import { readWebLayerTransform, sameLayerTransform } from "../sketch/layer-transform.js";

// Even the worst JSON escaping of 1,000 UTF-16 units fits below PeerJS's
// ~16 KB JSON frame limit. Splitting pairs is safe: frames decode back to the
// same code units before the complete context JSON is parsed.
export const LAYER_CONTEXT_CHARS_PER_MESSAGE = 1000;
export interface LayerContextChunk { from: number; data: string }

export function parseLayerContext(value: unknown): SketchLayer[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const result: SketchLayer[] = [], ids = new Set<number>();
  try {
    for (const entry of value) {
      if (!entry || typeof entry !== "object" || !Number.isSafeInteger(entry.id) || entry.id < 0 || entry.id > 0x7fffffff || ids.has(entry.id) || typeof entry.name !== "string" || typeof entry.visible !== "boolean" || typeof entry.locked !== "boolean") return undefined;
      ids.add(entry.id);
      result.push(createSketchLayer({ id: entry.id, name: entry.name, visible: entry.visible, locked: entry.locked, transform: readWebLayerTransform(entry.transform) }));
    }
  } catch { return undefined; }
  return result;
}

export function encodeLayerContext(layers: readonly SketchLayer[]): { length: number; chunks: LayerContextChunk[] } {
  const parsed = parseLayerContext(layers);
  if (!parsed) throw new Error("Invalid shared sketch layer definitions.");
  const text = JSON.stringify(parsed), chunks: LayerContextChunk[] = [];
  for (let from = 0; from < text.length; from += LAYER_CONTEXT_CHARS_PER_MESSAGE) {
    chunks.push({ from, data: text.slice(from, from + LAYER_CONTEXT_CHARS_PER_MESSAGE) });
  }
  return { length: text.length, chunks };
}

export class LayerContextReceiver {
  private length: number | undefined;
  private offset = 0;
  private parts: string[] = [];

  reset(): void { this.length = undefined; this.offset = 0; this.parts = []; }

  begin(length: number): void {
    if (this.length !== undefined || !Number.isSafeInteger(length) || length < 1) throw new Error("Invalid shared layer transfer start.");
    this.length = length; this.offset = 0; this.parts = [];
  }

  push(chunk: LayerContextChunk): SketchLayer[] | undefined {
    if (this.length === undefined || chunk.from !== this.offset || typeof chunk.data !== "string" || !chunk.data.length || chunk.data.length > LAYER_CONTEXT_CHARS_PER_MESSAGE || this.offset + chunk.data.length > this.length) throw new Error("Invalid or incomplete shared layer transfer.");
    this.parts.push(chunk.data); this.offset += chunk.data.length;
    if (this.offset !== this.length) return undefined;
    const text = this.parts.join(""); this.reset();
    let layers: SketchLayer[] | undefined;
    try { layers = parseLayerContext(JSON.parse(text)); } catch { /* Invalid JSON. */ }
    if (!layers) throw new Error("Invalid shared layer definitions.");
    return layers;
  }
}

/** Names/visibility follow the host. Existing local stroke coordinates can
 * only be retained if every used layer keeps the same effective pose. */
export function layerPosesCompatible(local: readonly SketchLayer[], incoming: readonly SketchLayer[], usedIds: Iterable<number>): boolean {
  const a = new Map(local.map(layer => [layer.id, layer])), b = new Map(incoming.map(layer => [layer.id, layer]));
  for (const id of usedIds) {
    const oldLayer = a.get(id), nextLayer = b.get(id);
    if (!oldLayer || !nextLayer || !sameLayerTransform(oldLayer.transform, nextLayer.transform)) return false;
  }
  return true;
}
