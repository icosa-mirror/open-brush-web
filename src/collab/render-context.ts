import type { Quat, Rgba } from "../types.js";
import { readNativeSketchRenderContext } from "../sketch/render-context.js";

interface NativeLight { Orientation: Quat; Color: Rgba }
/** Supported native metadata only. Colors and rotations retain their file
 * encoding; the renderer interprets them after the atomic snapshot arrives. */
export interface SharedRenderMetadata extends Record<string, unknown> {
  EnvironmentPreset?: string;
  Environment?: { FogColor: Rgba; FogDensity: number };
  Lights?: { Ambient: Rgba; Shadow: NativeLight; NoShadow: NativeLight };
}

export function selectSharedRenderMetadata(metadata?: Record<string, unknown>): SharedRenderMetadata {
  const context = readNativeSketchRenderContext(metadata);
  if (context.issues.length || (metadata?.EnvironmentPreset != null && typeof metadata.EnvironmentPreset !== "string")) throw new Error("Invalid shared light/fog metadata.");
  const result: SharedRenderMetadata = {};
  if (context.preset !== undefined) result.EnvironmentPreset = context.preset;
  if (context.fog) {
    const source = metadata!.Environment as { FogColor: Rgba; FogDensity: number };
    result.Environment = { FogColor: [...source.FogColor], FogDensity: source.FogDensity };
  }
  if (metadata?.Lights != null) {
    const source = metadata.Lights as NonNullable<SharedRenderMetadata["Lights"]>;
    const copy = (light: NativeLight): NativeLight => ({ Orientation: [...light.Orientation], Color: [...light.Color] });
    result.Lights = { Ambient: [...source.Ambient], Shadow: copy(source.Shadow), NoShadow: copy(source.NoShadow) };
  }
  return result;
}

export function parseSharedRenderMetadata(value: unknown): SharedRenderMetadata | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  try { return selectSharedRenderMetadata(value as Record<string, unknown>); } catch { return undefined; }
}

export function sameSharedRenderMetadata(a: SharedRenderMetadata, b: SharedRenderMetadata): boolean {
  return JSON.stringify(selectSharedRenderMetadata(a)) === JSON.stringify(selectSharedRenderMetadata(b));
}
