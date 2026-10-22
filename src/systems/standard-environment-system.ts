import {
  AssetManager,
  DoubleSide,
  FogExp2,
  Vector3,
  SRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  createSystem,
} from "@iwsdk/core";

import type { Entity } from "@iwsdk/core";

import { OpenBrushScenePose } from "../components/core.js";
import { assetUrl } from "../app/asset-url.js";
import { initialLoad } from "../app/initial-load.js";
import { openBrushShaderLibrary } from "../brushes/brush-shader-library.js";
import { OPENBRUSH_FOG_DENSITY } from "../brushes/brush-shader-materials.js";
import { sceneFogDensity } from "../sketch/render-context.js";
import { uniformWorldScale } from "../strokes/layer-space.js";

// ENVIRONMENT_STANDARD render settings (fog color/density) and the flat
// material colors of the EnvironmentPrefabs/Standard geometry nodes.
const FOG_COLOR = 0x2a2a35;
// Native density is per decimetre. The web scene uses metres, so geometry
// fog needs ten times that density; the maintained brush helper does this too.
// Tilt Brush uses Unity's plain Exponential fog; three's FogExp2 is squared,
// so the environment materials patch the fog chunk to the exponential form.
const FOG_DENSITY = sceneFogDensity(OPENBRUSH_FOG_DENSITY, 1);
const EXPONENTIAL_FOG_CHUNK = `
#ifdef USE_FOG
  float fogFactor = 1.0 - exp( - fogDensity * vFogDepth );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif
`;
// Authored albedos render near-black under the app's lighting; these match
// the captured in-app appearance (ground reads as black).
const NODE_COLORS: Readonly<Record<string, number>> = {
  Geo_Spikes: 0x000000,
  Geo_FloorBackground: 0x000000,
  Geo_FloorForeground: 0x030304,
  Geo_StandardStage: 0x141414,
};

/**
 * Loads Open Brush's default "Standard" environment (the silhouette mountain
 * ring, floor disks, and stage) under the scene pose root, so the two-hand
 * world grab turns and scales it with the sketch — the landmark feedback the
 * original gives while grabbing.
 */
export class StandardEnvironmentSystem extends createSystem({
  scenePoses: { required: [OpenBrushScenePose] },
}) {
  private loaded = false;
  private readonly sceneScale = new Vector3();
  private readonly fog = new FogExp2(FOG_COLOR, FOG_DENSITY);

  init() {
    this.world.scene.fog = this.fog;
    this.cleanupFuncs.push(() => {
      this.world.scene.fog = null;
    });
  }

  update() {
    const next = this.queries.scenePoses.entities.values().next();
    const scenePose = next.done ? undefined : next.value;
    if (!scenePose) {
      return;
    }
    const color = openBrushShaderLibrary.frameUniforms.u_fogColor.value;
    this.fog.color.setRGB(color.x, color.y, color.z, SRGBColorSpace);
    this.fog.density = sceneFogDensity(openBrushShaderLibrary.fogDensityNative, scenePose.object3D ? uniformWorldScale(scenePose.object3D, this.sceneScale) : 1);
    if (this.loaded) return;
    this.loaded = true;
    void this.loadEnvironment(scenePose);
  }

  private async loadEnvironment(scenePose: Entity): Promise<void> {
    try {
      const gltf = await AssetManager.loadGLTF(
        assetUrl("/openbrush/environment/standard.glb"),
        "openbrush-environment-standard",
      );
      const root = gltf.scene;
      root.name = "OpenBrushEnvironmentStandard";
      root.traverse((object) => {
        if (!(object instanceof Mesh)) {
          return;
        }
        const color = NODE_COLORS[object.name] ?? 0x000000;
        const material = new MeshBasicMaterial({ color, side: DoubleSide });
        material.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <fog_fragment>",
            EXPONENTIAL_FOG_CHUNK,
          );
        };
        object.material = material;
        object.raycast = () => {};
      });
      const entity = this.world.createTransformEntity(root, scenePose);
      entity.object3D!.name = "OpenBrushEnvironmentStandard";
    } catch (error) {
      console.warn("Standard environment failed to load:", error);
    } finally {
      initialLoad.complete("environment");
    }
  }
}
