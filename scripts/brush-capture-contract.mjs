/** Reject old/incompatible runtimes rather than accepting NaN or missing metadata as evidence. */
export function validateShaderCompileAudit(audit) {
  if (!audit || audit.context !== "nonimmersive" || !["linked", "failed", "unverified"].includes(audit.status) || !Number.isSafeInteger(audit.expectedMaterialPasses) || audit.expectedMaterialPasses < 1 || !Array.isArray(audit.programs) || !Array.isArray(audit.errors)) throw new Error("Browser shader compile audit is missing or incompatible.");
  const observed = new Set();
  for (const program of audit.programs) {
    if (!Number.isSafeInteger(program.materialPass) || program.materialPass < 0 || program.materialPass >= audit.expectedMaterialPasses) throw new Error("Browser shader audit has an invalid material pass.");
    observed.add(program.materialPass);
    if (program.linked !== true || program.vertexCompiled !== true || program.fragmentCompiled !== true) throw new Error("Browser shader compile/link audit failed.");
  }
  if (audit.status === "failed" || audit.errors.length) throw new Error("Browser shader compile/link audit failed.");
  if (audit.observedMaterialPasses !== observed.size) throw new Error("Browser shader audit pass count differs from observations.");
  const expectedStatus = audit.programs.length > 0 && observed.size === audit.expectedMaterialPasses ? "linked" : "unverified";
  if (audit.status !== expectedStatus) throw new Error("Browser shader audit status differs from observed material passes.");
}

export function validateBrushCapture(capture, size, nativeInput) {
  if (capture.width !== size || capture.height !== size) throw new Error("Browser capture dimensions differ from the unmodified reference.");
  const expected = nativeInput ? "native-capture" : "legacy-screenshot-fixture";
  if (capture.profile !== expected) throw new Error(`Browser capture input profile must be ${expected}; rebuild or use the matching runtime.`);
  if (!Number.isFinite(capture.coverage) || capture.coverage < 0 || capture.coverage > 1) throw new Error("GPU readback coverage is missing or invalid.");
  if (!["pass", "fail"].includes(capture.renderStatus)) throw new Error("Browser capture status is missing or invalid.");
  if (![2, 3, 4].includes(capture.generatedUv0Size) || capture.shaderUv0Size !== capture.generatedUv0Size) throw new Error("Browser capture UV0 layout is missing or differs from generated geometry.");
  validateShaderCompileAudit(capture.shaderCompileAudit);
  if (typeof capture.png !== "string" || !capture.png.startsWith("data:image/png;base64,")) throw new Error("Browser did not produce a PNG capture.");
}
