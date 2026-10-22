import type { Quat, Rgba, Vec3 } from "../types.js";
import { UNITS_TO_METERS } from "./tilt-brush-units.js";

export interface SketchDirectionalLight { orientation: Quat; color: Rgba }
export interface SketchRenderContext {
  preset?: string;
  fog?: { color: Vec3; density: number };
  ambient?: Rgba;
  shadow?: SketchDirectionalLight;
  noShadow?: SketchDirectionalLight;
  issues: string[];
}

function tuple(value: unknown, bytes = false): number[] | undefined {
  return Array.isArray(value) && value.length === 4 && value.every(channel => typeof channel === "number" && Number.isFinite(channel) && (!bytes || (Number.isInteger(channel) && channel >= 0 && channel <= 255))) ? value.slice() : undefined;
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/** Native metadata is retained separately; interpreting valid light/fog fields
 * must not rewrite its byte colors, HDR values, orientations or unknown fields. */
export function readNativeSketchRenderContext(metadata?: Record<string, unknown>): SketchRenderContext {
  const result: SketchRenderContext = { issues: [] };
  if (typeof metadata?.EnvironmentPreset === "string") result.preset = metadata.EnvironmentPreset;
  if (metadata?.Environment != null) {
    const environment = record(metadata.Environment), color = tuple(environment?.FogColor, true), density = environment?.FogDensity;
    if (color && typeof density === "number" && Number.isFinite(density) && density >= 0) result.fog = { color: [color[0] / 255, color[1] / 255, color[2] / 255], density };
    else result.issues.push("Invalid custom fog fields");
  }
  if (metadata?.Lights != null) {
    const lights = record(metadata.Lights), ambient = tuple(lights?.Ambient, true);
    if (ambient) result.ambient = ambient.map(channel => channel / 255) as Rgba;
    else result.issues.push("Invalid custom ambient color");
    for (const [field, key] of [["Shadow", "shadow"], ["NoShadow", "noShadow"]] as const) {
      const light = record(lights?.[field]), orientation = tuple(light?.Orientation), color = tuple(light?.Color);
      const length = orientation ? Math.hypot(...orientation) : 0;
      if (orientation && length > 0 && Number.isFinite(length) && color) {
        // Metadata light rotations are scene-local in native Unity basis.
        result[key] = { orientation: [-orientation[0] / length, -orientation[1] / length, orientation[2] / length, orientation[3] / length], color: color as Rgba };
      } else result.issues.push(`Invalid custom ${field} light`);
    }
  }
  return result;
}

/** Maintained ApplyFog already multiplies native density by ten. Native
 * SceneSettings divides density by the scene pose scale before rendering. */
export function brushFogDensity(nativeDensity: number, sceneScale: number): number {
  return nativeDensity / (Number.isFinite(sceneScale) && sceneScale !== 0 ? Math.abs(sceneScale) : 1);
}
export function sceneFogDensity(nativeDensity: number, sceneScale: number): number {
  return brushFogDensity(nativeDensity, sceneScale) / UNITS_TO_METERS;
}
