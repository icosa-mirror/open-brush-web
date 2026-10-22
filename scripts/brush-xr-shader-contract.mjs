import { validateShaderCompileAudit } from "./brush-capture-contract.mjs";

export function xrGraphicsWarnings(messages) {
  return messages.filter(message => /WebGL.*(?:INVALID_|error)|GL_INVALID|framebuffer.*incomplete/i.test(message.text));
}

export function validateXrBrushShaderAudit(result) {
  if (result?.rendererPresenting !== true || result.emulatorSessionMatches !== true || result.rendererSessionMatches !== true) throw new Error("XR audit requires matching active emulator/world/renderer sessions.");
  if (result.renderedCameras !== 2 || result.xrCameras !== 2 || !Array.isArray(result.viewerEyes) || result.viewerEyes.length !== 2 || [...result.viewerEyes].sort().join(",") !== "left,right") throw new Error("XR audit requires two rendered cameras and left/right viewer poses.");
  if (!result.enabledFeatures?.includes("hand-tracking") || result.layersApiAvailable !== true || result.baseLayerHasGetViewport !== false || result.renderStateLayerMatches !== true) throw new Error("XR audit requires granted hand tracking and an active matching projection layer (native or polyfilled).");
  validateShaderCompileAudit(result.audit, "xr-presenting");
  if (result.audit.status !== "linked") throw new Error("XR material pass observations are incomplete.");
  if (!Array.isArray(result.materialPassesByCamera) || result.materialPassesByCamera.length !== 2 || result.materialPassesByCamera.some(passes => !Array.isArray(passes) || passes.length !== result.audit.expectedMaterialPasses || new Set(passes).size !== passes.length || passes.some(pass => !Number.isSafeInteger(pass) || pass < 0 || pass >= result.audit.expectedMaterialPasses))) throw new Error("XR audit requires every material pass for both view cameras.");
  if (!Array.isArray(result.cameraPositions) || result.cameraPositions.length !== 2 || result.cameraPositions.some(position => !Array.isArray(position) || position.length !== 3 || position.some(value => !Number.isFinite(value))) || result.cameraPositions[0].every((value,index) => value === result.cameraPositions[1][index])) throw new Error("XR view cameras need distinct finite eye positions.");
  if (![2,3,4].includes(result.generatedUv0Size) || result.generatedUv0Size !== result.shaderUv0Size) throw new Error("XR shader UV0 layout differs from the generator.");
}
