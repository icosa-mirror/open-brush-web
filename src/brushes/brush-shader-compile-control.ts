import { World, BufferGeometry, BufferAttribute, Mesh, Scene, ShaderMaterial, PerspectiveCamera, WebGLRenderTarget } from "@iwsdk/core";
import { auditBrushShaderCompile } from "./brush-shader-compile-audit.js";

export async function testCompileAudit() {
  const container = document.createElement("div");
  container.style.cssText = "width:640px;height:480px";
  document.body.append(container);
  const world = await World.create(container, {xr:false});
  const renderer = world.renderer;
  const results = [];
  for (const broken of [false, true]) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array([-1,-1,0, 1,-1,0, 0,1,0]),3));
    const material = new ShaderMaterial({
      vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
      fragmentShader: broken ? "void main(){gl_FragColor=vec4(1.0) BROKEN;}" : "void main(){gl_FragColor=vec4(1.0);}",
    });
    material.name = broken ? "deliberately-invalid-fragment" : "valid-control";
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    const scene = new Scene(); scene.add(mesh);
    const target = new WebGLRenderTarget(4,4);
    const previousTarget = renderer.getRenderTarget();
    const originalUse = renderer.getContext().useProgram;
    const originalError = renderer.debug.onShaderError;
    const originalCheck = renderer.debug.checkShaderErrors;
    const originalKey = material.customProgramCacheKey;
    const originalBefore = mesh.onBeforeRender;
    try {
      renderer.setRenderTarget(target);
      const result = auditBrushShaderCompile(renderer,mesh,[material],()=>renderer.render(scene,new PerspectiveCamera()));
      const restored = renderer.getContext().useProgram === originalUse && renderer.debug.onShaderError === originalError && renderer.debug.checkShaderErrors === originalCheck && material.customProgramCacheKey === originalKey && mesh.onBeforeRender === originalBefore;
      if (!restored || result.status !== (broken ? "failed" : "linked")) throw new Error(`Unexpected audit/restoration result for broken=${broken}`);
      results.push({broken,restored,result});
    } finally { renderer.setRenderTarget(previousTarget); geometry.dispose(); material.dispose(); target.dispose(); }
  }
  return results;
}
