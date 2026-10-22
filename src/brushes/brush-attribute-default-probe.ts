import type { Material, Mesh, WebGLRenderer } from "@iwsdk/core";

export interface BrushDefaultProbe {
  drawCalls: number;
  changes: Array<{ materialName: string; attribute: string; original: number[]; supplied: number[] }>;
  programs: Array<{ materialName: string; newExporter: boolean | string; tiltInput: boolean | string; vertexSource: string }>;
}

/** Counterfactual diagnostic for owned offscreen meshes. Perturb only disabled,
 * unbound float user attributes, immediately before drawing; restore afterward.
 * Built-ins such as gl_VertexID never receive fabricated geometry buffers.
 */
export function probeBrushAttributeDefaults(renderer: WebGLRenderer, mesh: Mesh, render: () => void): BrushDefaultProbe {
  const gl = renderer.getContext();
  const drawElements = gl.drawElements, drawArrays = gl.drawArrays;
  const beforeRender = mesh.onBeforeRender;
  const supplied = new Float32Array([8192.5, -6144.25, 12345.75, -3.5]);
  const floatTypes: readonly number[] = [gl.FLOAT, gl.FLOAT_VEC2, gl.FLOAT_VEC3, gl.FLOAT_VEC4];
  const result: BrushDefaultProbe = { drawCalls: 0, changes: [], programs: [] };
  const seen = new Set<WebGLProgram>();
  let material: Material | undefined;
  const flag = (program: WebGLProgram, name: string): boolean | string => {
    const location = gl.getUniformLocation(program, name);
    if (location === null) return "not-active";
    const value = gl.getUniform(program, location);
    return typeof value === "boolean" ? value : "unexpected-type";
  };
  const draw = (invoke: () => void) => {
    result.drawCalls++;
    const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null;
    if (!program || gl.getProgramParameter(program, gl.LINK_STATUS) !== true) throw new Error("Attribute probe requires a linked current program.");
    const restore: Array<{ location: number; value: Float32Array }> = [];
    try {
      for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES); i++) {
        const attribute = gl.getActiveAttrib(program, i);
        if (!attribute || attribute.name.startsWith("gl_") || mesh.geometry.getAttribute(attribute.name)) continue;
        const location = gl.getAttribLocation(program, attribute.name);
        if (location < 0 || gl.getVertexAttrib(location, gl.VERTEX_ATTRIB_ARRAY_ENABLED)) throw new Error(`Attribute probe cannot safely perturb ${attribute.name}.`);
        if (!floatTypes.includes(attribute.type)) throw new Error("Attribute probe supports float user inputs only.");
        const value = new Float32Array(gl.getVertexAttrib(location, gl.CURRENT_VERTEX_ATTRIB));
        restore.push({location,value});
        gl.vertexAttrib4fv(location, supplied);
        result.changes.push({ materialName: material?.name ?? "unknown", attribute: attribute.name, original: Array.from(value), supplied: Array.from(supplied) });
      }
      if (restore.length && !seen.has(program)) {
        seen.add(program);
        const vertex = (gl.getAttachedShaders(program) ?? []).find((shader) => gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.VERTEX_SHADER);
        result.programs.push({ materialName: material?.name ?? "unknown", newExporter: flag(program,"u_isNewTiltExporter"), tiltInput: flag(program,"u_isTiltInput"), vertexSource: vertex ? gl.getShaderSource(vertex) ?? "" : "" });
      }
      invoke();
    } finally { for (const entry of restore) gl.vertexAttrib4fv(entry.location, entry.value); }
  };
  try {
    mesh.onBeforeRender = (...args) => { material=args[4]; beforeRender.apply(mesh,args); };
    gl.drawElements = (...args) => draw(() => drawElements.apply(gl,args));
    gl.drawArrays = (...args) => draw(() => drawArrays.apply(gl,args));
    render();
  } finally { gl.drawElements=drawElements;gl.drawArrays=drawArrays;mesh.onBeforeRender=beforeRender; }
  return result;
}

export function compareProbeRgb(a: Uint8Array, b: Uint8Array) {
  if(a.length!==b.length || a.length%4) throw new Error("Probe requires equally sized RGBA buffers.");
  let changedPixels=0, maxByteDifference=0;
  for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<3;c++){const difference=Math.abs(a[i+c]-b[i+c]);maxByteDifference=Math.max(maxByteDifference,difference);changed ||= difference!==0;}if(changed)changedPixels++;}
  return {changedPixels,maxByteDifference};
}
