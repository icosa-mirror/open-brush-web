import type { BrushGeometryArrays } from "./brush-geometry.js";

/** Native PointerScript replay feeds positions/pressure to GeometryBrush,
 * whose new knots use CurrentSketchTime, rather than saved point timestamps.
 * The shared generator's deterministic birth channel is zero; install the
 * application's replay origin without changing persisted control points.
 * Call after generation, before GPU binding or batch copying. */
export function setReplayedParticleBirthTime(
  arrays: BrushGeometryArrays,
  generatorClass: string | undefined,
  replayTimeSeconds: number,
): void {
  let values: Float32Array;
  if (generatorClass === "GeniusParticlesBrush" && arrays.uv0Size === 4) values = arrays.particleUvs;
  else if (generatorClass === "MidpointPlusLifetimeSprayBrush" && arrays.uv1Size === 4) values = arrays.uv1s;
  else return;
  for (let vertex = 0; vertex < arrays.vertexCount; vertex++) values[vertex * 4 + 3] = replayTimeSeconds;
}
