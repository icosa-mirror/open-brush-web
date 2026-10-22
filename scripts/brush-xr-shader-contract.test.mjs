import { describe, expect, it } from "vitest";
import { validateXrBrushShaderAudit, xrGraphicsWarnings } from "./brush-xr-shader-contract.mjs";
const sample=()=>({rendererPresenting:true,emulatorSessionMatches:true,rendererSessionMatches:true,renderedCameras:2,xrCameras:2,viewerEyes:["left","right"],enabledFeatures:["hand-tracking"],layersApiAvailable:true,baseLayerHasGetViewport:false,renderStateLayerMatches:true,materialPassesByCamera:[[0],[0]],cameraPositions:[[-0.03,1.6,0],[0.03,1.6,0]],generatedUv0Size:3,shaderUv0Size:3,audit:{status:"linked",context:"xr-presenting",expectedMaterialPasses:1,observedMaterialPasses:1,programs:[{materialPass:0,linked:true,vertexCompiled:true,fragmentCompiled:true}],errors:[]}});
describe("emulated XR shader evidence contract",()=>{
 it("treats WebGL invalid-operation warnings as failures separately from ordinary deprecation notices",()=>{
  const messages=[{type:"warning",text:"WebGL: INVALID_OPERATION: useProgram: attempt to use a deleted object"},{type:"warning",text:"THREE.Clock: deprecated"}];
  expect(xrGraphicsWarnings(messages)).toEqual([messages[0]]);
 });
 it("requires a real active XR path, session identity and both eyes",()=>{
  expect(()=>validateXrBrushShaderAudit(sample())).not.toThrow();
  for(const key of ["rendererPresenting","emulatorSessionMatches","rendererSessionMatches"])expect(()=>validateXrBrushShaderAudit({...sample(),[key]:false})).toThrow("matching active");
  expect(()=>validateXrBrushShaderAudit({...sample(),viewerEyes:["left","left"]})).toThrow("left/right");
  expect(()=>validateXrBrushShaderAudit({...sample(),renderedCameras:1})).toThrow("two rendered cameras");
 });
 it("rejects desktop compile records and absent active projection layers",()=>{
  const row=sample();row.audit.context="nonimmersive";
  expect(()=>validateXrBrushShaderAudit(row)).toThrow("missing or incompatible");
  expect(()=>validateXrBrushShaderAudit({...sample(),baseLayerHasGetViewport:true})).toThrow("active matching projection layer");
  expect(()=>validateXrBrushShaderAudit({...sample(),enabledFeatures:["layers"],renderStateLayerMatches:false})).toThrow("active matching projection layer");
 });
 it("requires every pass on both cameras, distinct eye transforms and matching UV layout",()=>{
  expect(()=>validateXrBrushShaderAudit({...sample(),materialPassesByCamera:[[0],[]]})).toThrow("every material pass");
  expect(()=>validateXrBrushShaderAudit({...sample(),cameraPositions:[[0,1,0],[0,1,0]]})).toThrow("distinct finite");
  expect(()=>validateXrBrushShaderAudit({...sample(),shaderUv0Size:2})).toThrow("UV0 layout");
 });
});
