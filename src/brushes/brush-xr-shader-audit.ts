import "../three-workarounds.js";
import { World, SessionMode, Mesh } from "@iwsdk/core";
import { openBrushInventory } from "./brush-catalog.js";
import { generateBrushGeometry } from "./brush-geometry.js";
import { openBrushShaderLibrary } from "./brush-shader-library.js";
import { createBrushRenderMaterial, applyBrushRenderGroups } from "./brush-render-material.js";
import { createBrushDiagnosticGeometry } from "./brush-visual-conformance.js";
import { auditBrushShaderCompile } from "./brush-shader-compile-audit.js";
import type { StrokeData } from "../types.js";
import type { XRDevice } from "iwer";
export async function startBrushXrShaderAudit(container:HTMLDivElement,enterButton:HTMLElement){
const iwer=(window as unknown as {IWER_DEVICE:XRDevice}).IWER_DEVICE;
if(!iwer)throw Error("IWER runtime was not installed by the Vite HTML transform.");
iwer.stereoEnabled=true;
iwer.installRuntime({globalObject:window,polyfillLayers:true});
iwer.ipd=0.063;
for(const input of [...Object.values(iwer.controllers),...Object.values(iwer.hands)])if(input)input.connected=false;
const world=await World.create(container,{xr:{offer:"none",sessionMode:SessionMode.ImmersiveVR,features:{handTracking:true,layers:true}},render:{defaultLighting:false},features:{spatialUI:false,locomotion:false,grabbing:false,physics:false}});
world.player.visible=false;
const gl=world.renderer.getContext(),debug=gl.getExtension("WEBGL_debug_renderer_info");
const rendererDescription=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null;
enterButton.onclick=()=>world.launchXR();
async function run(guid:string,stroke:StrokeData){
 if(!world.renderer.xr.isPresenting||!world.session)throw Error("Active XR session required.");
 const entry=openBrushInventory.find(e=>e.guid===guid);if(!entry)throw Error("Unknown brush");
 const source=await openBrushShaderLibrary.load(entry);if(!source)throw Error("Material did not load");
 const generated=generateBrushGeometry(stroke,entry.geometryFamily,{pressureSizeRange:entry.pressureSizeRange,pressureOpacityRange:entry.pressureOpacityRange,geometryParams:entry.geometryParams,generatorClass:entry.generatorClass});
 const geometry=createBrushDiagnosticGeometry(generated,guid);
 const material=source.clone(),renderMaterial=createBrushRenderMaterial(guid,material);applyBrushRenderGroups(geometry,generated.indices.length,renderMaterial);
 const mesh=new Mesh(geometry,renderMaterial);mesh.frustumCulled=false;
 geometry.computeBoundingBox();if(geometry.boundingBox&&!geometry.boundingBox.isEmpty()){const b=geometry.boundingBox;mesh.position.set(-(b.min.x+b.max.x)/2,1.6-(b.min.y+b.max.y)/2,-2-(b.min.z+b.max.z)/2);}
 const entity=world.createTransformEntity(mesh);
 const cameras=new Map<string,Set<number>>();
 const passes=Array.isArray(renderMaterial)?renderMaterial:[renderMaterial];
 mesh.onBeforeRender=(_r,_s,c,_g,m)=>{let seen=cameras.get(c.uuid);if(!seen){seen=new Set();cameras.set(c.uuid,seen)}seen.add(passes.indexOf(m));};
 const renderer=world.renderer,original=renderer.render;
 try{return await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{renderer.render=original;reject(Error("No audited XR frame within 30 seconds"));},30000);
  renderer.render=(scene,camera)=>{
   renderer.render=original;
   try{
    world.scene.traverse(o=>{if(o instanceof Mesh&&o!==mesh)o.visible=false});
    openBrushShaderLibrary.updateFrame(0.5,world.camera);
    const audit=auditBrushShaderCompile(renderer,mesh,Array.isArray(renderMaterial)?renderMaterial:[renderMaterial],()=>original.call(renderer,scene,camera));
    const frame=renderer.xr.getFrame(),space=renderer.xr.getReferenceSpace();
    const pose=space?frame.getViewerPose(space):null;
    const result={audit,rendererPresenting:renderer.xr.isPresenting,emulatorSessionMatches:(iwer.activeSession as unknown)===world.session,rendererSessionMatches:renderer.xr.getSession()===world.session,emulator:iwer.name,emulatorVersion:iwer.version,viewerEyes:pose?.views.map(v=>v.eye),renderedCameras:cameras.size,xrCameras:renderer.xr.getCamera().cameras.length,
      materialPassesByCamera:Array.from(cameras.values(),set=>Array.from(set).sort()),
      cameraPositions:renderer.xr.getCamera().cameras.map(camera=>camera.matrixWorld.elements.slice(12,15)),
      generatedUv0Size:generated.uv0Size,shaderUv0Size:geometry.getAttribute("a_texcoord0").itemSize,
      enabledFeatures:Array.from((world.session as unknown as {enabledFeatures?:string[]}).enabledFeatures??[]),
      baseLayerConstructor:renderer.xr.getBaseLayer().constructor.name,
      baseLayerHasGetViewport:"getViewport" in renderer.xr.getBaseLayer(),
      layersApiAvailable:typeof (window as unknown as {XRWebGLBinding?:unknown}).XRWebGLBinding==="function",
      renderStateLayerMatches:Array.from((world.session?.renderState as unknown as {layers?:unknown[]}|undefined)?.layers??[]).includes(renderer.xr.getBaseLayer()),
      emulatorLayerPolyfillEnabled:true,emulatorStereoEnabled:iwer.stereoEnabled,emulatorIpd:iwer.ipd};
    clearTimeout(timeout);resolve(result);
   }catch(e){clearTimeout(timeout);reject(e)}
  };
 });}finally{renderer.render=original;renderer.resetState();entity.dispose();if(Array.isArray(renderMaterial))material.dispose();}
}
return {run,status:()=>({presenting:world.renderer.xr.isPresenting,emulator:iwer.name,renderer:rendererDescription}),end:()=>world.session?.end()};
}
