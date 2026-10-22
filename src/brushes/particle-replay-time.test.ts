import { expect, it } from "vitest";
import { createBrushGeometryArrays, generateBrushGeometryInto } from "./brush-geometry.js";
import { openBrushInventory } from "./brush-catalog.js";
import { createEmptyStrokeData, type Vec3 } from "../types.js";
import { setReplayedParticleBirthTime } from "./particle-replay-time.js";

it("uses replay time for generated particle births while retaining other packed channels", () => {
  const entries = openBrushInventory.filter(entry => ["GeniusParticlesBrush", "MidpointPlusLifetimeSprayBrush"].includes(entry.generatorClass ?? ""));
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    const data = createEmptyStrokeData({ brushGuid: entry.guid, brushSize: 0.05, seed: 5,
      controlPoints: Array.from({ length: 36 }, (_, i) => ({ position: [i * 0.04, Math.sin(i * 0.1) * 0.05, 0] as Vec3,
        orientation: [0, 0, 0, 1], pressure: 1, timestampMs: 500000 + i * 20 })) });
    const before = JSON.stringify(data), arrays = createBrushGeometryArrays();
    generateBrushGeometryInto(data, entry.geometryFamily, { generatorClass: entry.generatorClass,
      geometryParams: entry.geometryParams, deterministicBirthTime: true, finalized: true }, arrays);
    expect(arrays.vertexCount, entry.name).toBeGreaterThan(0);
    const values = entry.generatorClass === "GeniusParticlesBrush" ? arrays.particleUvs : arrays.uv1s;
    const original = values.slice();
    setReplayedParticleBirthTime(arrays, entry.generatorClass, 125.25);
    for (let i = 0; i < arrays.vertexCount * 4; i++) expect(values[i], `${entry.name} channel ${i}`).toBe(i % 4 === 3 ? 125.25 : original[i]);
    expect(values.slice(arrays.vertexCount * 4)).toEqual(original.slice(arrays.vertexCount * 4));
    expect(JSON.stringify(data)).toBe(before);
  }
});
