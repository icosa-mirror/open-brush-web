import type { Material, Mesh, WebGLRenderer } from "@iwsdk/core";

export interface BrushBoundProgramAudit {
  materialName: string;
  materialPass: number;
  materialSide: number;
  linked: boolean;
  vertexCompiled: boolean;
  fragmentCompiled: boolean;
  activeAttributes: Array<{ name: string; type: number; size: number; boundItemSize: number | null }>;
}

export interface BrushShaderCompileAudit {
  status: "linked" | "failed" | "unverified";
  context: "nonimmersive" | "xr-presenting";
  expectedMaterialPasses: number;
  observedMaterialPasses: number;
  programs: BrushBoundProgramAudit[];
  errors: string[];
}

/** One-shot offscreen diagnostic. Call only with owned, disposable material
 * clones: unique cache keys force program creation under this audit's callback.
 * GL introspection runs only during this synchronous render, never live drawing.
 */
export function auditBrushShaderCompile(
  renderer: WebGLRenderer,
  mesh: Mesh,
  materials: Material[],
  render: () => void,
): BrushShaderCompileAudit {
  const gl = renderer.getContext();
  const result: BrushShaderCompileAudit = {
    status: "unverified", context: renderer.xr.isPresenting ? "xr-presenting" : "nonimmersive",
    expectedMaterialPasses: materials.length, observedMaterialPasses: 0, programs: [], errors: [],
  };
  const originalUseProgram = gl.useProgram;
  const originalBeforeRender = mesh.onBeforeRender;
  const previousCheck = renderer.debug.checkShaderErrors;
  const previousError = renderer.debug.onShaderError;
  const keys = materials.map((material) => material.customProgramCacheKey);
  let currentMaterial: Material | undefined;
  const observed = new Set<number>();
  const seen = new Map<WebGLProgram, Set<number>>();
  try {
    materials.forEach((material, index) => {
      material.customProgramCacheKey = () => `${keys[index].call(material)}|brush-compile-audit:${material.uuid}`;
    });
    mesh.onBeforeRender = (...args) => {
      currentMaterial = args[4];
      originalBeforeRender.apply(mesh, args);
    };
    renderer.debug.checkShaderErrors = true;
    renderer.debug.onShaderError = (context, program, vertex, fragment) => {
      const message = (context.getProgramInfoLog(program) || context.getShaderInfoLog(vertex) || context.getShaderInfoLog(fragment) || "Shader compile/link failure").slice(0, 1000);
      result.errors.push(message);
      if (previousError) previousError(context, program, vertex, fragment);
      else console.error(`[BrushShaderCompileAudit] ${message}`);
    };
    gl.useProgram = (program) => {
      originalUseProgram.call(gl, program);
      if (!program) return;
      const materialPass = currentMaterial ? materials.indexOf(currentMaterial) : -1;
      if (materialPass < 0) { result.errors.push("Program bind was not attributable to a capture material."); return; }
      let passes = seen.get(program);
      if (!passes) { passes = new Set(); seen.set(program, passes); }
      if (passes.has(materialPass)) return;
      passes.add(materialPass); observed.add(materialPass);
      const shaders = gl.getAttachedShaders(program) ?? [];
      const vertex = shaders.filter((shader) => gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.VERTEX_SHADER);
      const fragment = shaders.filter((shader) => gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER);
      const audit: BrushBoundProgramAudit = {
        materialName: currentMaterial!.name, materialPass, materialSide: currentMaterial!.side,
        linked: gl.getProgramParameter(program, gl.LINK_STATUS) === true,
        vertexCompiled: vertex.length === 1 && gl.getShaderParameter(vertex[0], gl.COMPILE_STATUS) === true,
        fragmentCompiled: fragment.length === 1 && gl.getShaderParameter(fragment[0], gl.COMPILE_STATUS) === true,
        activeAttributes: [],
      };
      if (audit.linked) {
        for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES); i++) {
          const attribute = gl.getActiveAttrib(program, i);
          if (attribute) audit.activeAttributes.push({ name: attribute.name, type: attribute.type, size: attribute.size,
            boundItemSize: mesh.geometry.getAttribute(attribute.name)?.itemSize ?? null });
        }
      }
      result.programs.push(audit);
    };
    render();
  } finally {
    gl.useProgram = originalUseProgram;
    mesh.onBeforeRender = originalBeforeRender;
    renderer.debug.checkShaderErrors = previousCheck;
    renderer.debug.onShaderError = previousError;
    materials.forEach((material, index) => { material.customProgramCacheKey = keys[index]; });
  }
  result.observedMaterialPasses = observed.size;
  if (result.errors.length || result.programs.some((program) => !program.linked || !program.vertexCompiled || !program.fragmentCompiled)) result.status = "failed";
  else if (result.programs.length > 0 && observed.size === materials.length) result.status = "linked";
  return result;
}
