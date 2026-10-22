import { World, BufferGeometry, BufferAttribute, Mesh, Scene, ShaderMaterial, PerspectiveCamera, WebGLRenderTarget } from "@iwsdk/core";
import { probeBrushAttributeDefaults, compareProbeRgb } from "./brush-attribute-default-probe.js";
import { auditBrushShaderCompile } from "./brush-shader-compile-audit.js";

export async function testAttributeDefaultProbe() {
  const container=document.createElement("div");container.style.cssText="width:64px;height:64px";document.body.append(container);
  const world=await World.create(container,{xr:false}),renderer=world.renderer,gl=renderer.getContext();
  const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(new Float32Array([-1,-1,0,1,-1,0,0,1,0]),3));
  const material=new ShaderMaterial({vertexShader:"attribute vec4 a_probe; varying vec4 v_probe; void main(){v_probe=a_probe;gl_Position=vec4(position,1.0);}",fragmentShader:"varying vec4 v_probe; void main(){gl_FragColor=vec4(clamp(abs(v_probe.xyz)*0.001,0.0,1.0),1.0);}"});
  material.name="active-unbound-attribute-control";
  const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;const scene=new Scene();scene.add(mesh);
  const camera=new PerspectiveCamera(),target=new WebGLRenderTarget(4,4),originalTarget=renderer.getRenderTarget();
  const a=new Uint8Array(64),b=new Uint8Array(64),drawElements=gl.drawElements,drawArrays=gl.drawArrays,before=mesh.onBeforeRender;
  try{
    renderer.setRenderTarget(target);
    let probe:ReturnType<typeof probeBrushAttributeDefaults>|undefined;
    const render=()=>{renderer.clear();renderer.render(scene,camera);};
    const compile=auditBrushShaderCompile(renderer,mesh,[material],()=>{render();renderer.readRenderTargetPixels(target,0,0,4,4,a);probe=probeBrushAttributeDefaults(renderer,mesh,render);renderer.readRenderTargetPixels(target,0,0,4,4,b);});
    if(!probe || compile.status!=="linked" || probe.changes.length!==1)throw new Error("Attribute probe control did not observe its input.");
    const difference=compareProbeRgb(a,b);
    const program=gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
    const location=gl.getAttribLocation(program,"a_probe");
    const values=gl.getVertexAttrib(location,gl.CURRENT_VERTEX_ATTRIB) as Float32Array;
    const restored=gl.drawElements===drawElements && gl.drawArrays===drawArrays && mesh.onBeforeRender===before && probe.changes[0].original.every((value,i)=>value===values[i]);
    if(!restored || difference.changedPixels===0)throw new Error("Attribute probe did not detect a live input or restore its state.");
    return {compile,probe,difference,restored};
  }finally{renderer.setRenderTarget(originalTarget);geometry.dispose();material.dispose();target.dispose();}
}
