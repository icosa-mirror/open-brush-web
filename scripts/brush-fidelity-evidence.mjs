import { validateShaderCompileAudit } from "./brush-capture-contract.mjs";
import { validateXrBrushShaderAudit } from "./brush-xr-shader-contract.mjs";

export function indexGuidRows(rows, key, label) {
  if (!Array.isArray(rows)) throw new Error(`Missing ${label} rows.`);
  const result = new Map();
  for (const row of rows) {
    if (!row || typeof row[key] !== "string") throw new Error(`Invalid ${label} GUID.`);
    const guid = row[key].toLowerCase();
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(guid)) throw new Error(`Invalid ${label} GUID.`);
    if (result.has(guid)) throw new Error(`Duplicate ${label} GUID ${guid}.`);
    result.set(guid, row);
  }
  return result;
}

export function requireMatchingHash(actual, expected, label) {
  if (!/^[0-9a-f]{64}$/.test(actual) || actual !== expected) throw new Error(`${label} hash differs or is missing.`);
}

export function joinBrushFidelityEvidence(required, data) {
  const maps = {
    native: indexGuidRows(data.generation.artifacts, "brushGuid", "native generation"),
    mesh: indexGuidRows(data.mesh.brushes, "brushGuid", "live mesh"),
    meshInputs: indexGuidRows(data.mesh.evidence.inputs, "guid", "live mesh input"),
    exports: indexGuidRows(data.exports.brushes, "guid", "export accessor"),
    captures: indexGuidRows(data.captures.results, "guid", "browser capture"),
    layout: indexGuidRows(data.layout.brushes, "guid", "vertex layout"),
    images: indexGuidRows(data.images.images, "guid", "native image"),
  };
  const take = (stage, guid) => {
    const row = maps[stage].get(guid);
    if (!row) throw new Error(`Missing ${stage} evidence for ${guid}.`);
    return row;
  };
  if (!Array.isArray(data.postLoader.results)) throw new Error("Missing post-loader rows.");
  const post = new Map();
  for (const row of data.postLoader.results) {
    if (post.has(row.name)) throw new Error(`Duplicate post-loader file ${row.name}.`);
    post.set(row.name, row);
  }
  const normalExports = data.postLoader.results.filter((row) => row.generator?.includes("Open Brush UnityGLTF Exporter"));
  const compileRows = data.compileCaptures ? indexGuidRows(data.compileCaptures.results, "guid", "browser shader compile") : null;
  const probeRows = data.attributeProbeCaptures ? indexGuidRows(data.attributeProbeCaptures.results, "guid", "attribute-default probe") : null;
  const xrRows = data.emulatedXr ? indexGuidRows(data.emulatedXr.results, "guid", "emulated XR") : null;
  if (xrRows && (!data.emulatedXr.completedAt || data.emulatedXr.sessionEnded !== true || data.emulatedXr.error || data.emulatedXr.consoleErrorCount !== 0 || data.emulatedXr.graphicsWarningCount !== 0 || !Array.isArray(data.emulatedXr.pageErrors) || data.emulatedXr.pageErrors.length)) throw new Error("Emulated XR run is incomplete or contains browser/graphics errors.");
  if (probeRows) {
    const control = data.attributeProbeControls?.attributeProbeControl;
    if (!control?.restored || control.compile?.status !== "linked" || !(control.difference?.changedPixels > 0) || data.attributeProbeControls.pageErrors?.length !== 0) throw new Error("Missing passing attribute-probe sensitivity/restoration control.");
  }
  return required.map(({ guid, name, catalogSection }) => {
    const native = take("native", guid), mesh = take("mesh", guid), exported = take("exports", guid);
    const capture = take("captures", guid), layout = take("layout", guid), image = take("images", guid);
    requireMatchingHash(take("meshInputs", guid).sha256, native.mesh.sha256, `${guid} live-mesh input`);
    requireMatchingHash(exported.meshSha256, native.mesh.sha256, `${guid} post-baker input`);
    requireMatchingHash(layout.sha256, native.mesh.sha256, `${guid} layout input`);
    requireMatchingHash(exported.glbSha256, native.glb.sha256, `${guid} exported GLB`);
    requireMatchingHash(capture.referenceSha256, image.sha256, `${guid} reference image`);
    const loaded = post.get(exported.glbFile);
    if (!loaded) throw new Error(`Missing post-loader fixture for ${guid}.`);
    requireMatchingHash(loaded.sha256, exported.glbSha256, `${guid} post-loader GLB`);
    const normalMeshes = normalExports.flatMap((file) => (file.meshes ?? []).filter((item) => item.before.materials.some((material) => material.name === `ob-${name}`)).map((item) => ({
      file: file.name, fileSha256: file.sha256, mesh: item.name, inspectionStatus: file.status,
      exporterFlags: item.after.materials.map((material) => material.newExporterFlag),
    })));
    const shaderMeshes = loaded.meshes.filter((item) => item.after.materials.some((material) => material.newExporterFlag !== null)).length;
    const compile = compileRows?.get(guid);
    if (compileRows && !compile) throw new Error(`Missing browser shader compile evidence for ${guid}.`);
    let compileStatus = "unverified";
    if (compile) {
      requireMatchingHash(compile.referenceSha256, image.sha256, `${guid} compile capture reference`);
      if (compile.shaderCompileAudit?.status === "failed") compileStatus = "recorded-failed";
      else {
        validateShaderCompileAudit(compile.shaderCompileAudit);
        if (compile.status === "captured" && compile.shaderCompileAudit.status === "linked" && compile.consoleErrorCount === 0 && compile.pageErrorCount === 0) compileStatus = "recorded-linked";
      }
    }
    const probeCapture = probeRows?.get(guid);
    const xr = xrRows?.get(guid);
    if (xrRows) {
      if (!xr) throw new Error(`Missing emulated XR evidence for ${guid}.`);
      requireMatchingHash(xr.meshSha256, native.mesh.sha256, `${guid} XR native input`);
      validateXrBrushShaderAudit(xr);
      if (xr.status !== "emulated-xr-linked") throw new Error(`Failed emulated XR evidence for ${guid}.`);
    }
    let attributeProbe = { source: null, status: "unverified" };
    if (probeCapture) {
      requireMatchingHash(probeCapture.referenceSha256, image.sha256, `${guid} attribute probe reference`);
      validateShaderCompileAudit(probeCapture.shaderCompileAudit);
      const probe = probeCapture.attributeDefaultProbe;
      if (!probe || !Number.isSafeInteger(probe.changedPixels) || probe.changedPixels < 0 || !Array.isArray(probe.changes) || !Array.isArray(probe.programs)) throw new Error(`Invalid attribute-probe data for ${guid}.`);
      const observed = probeCapture.status === "captured" && probeCapture.renderStatus === "pass" && probeCapture.shaderCompileAudit.status === "linked" && probe.drawCalls > 0 && probe.changes.length > 0;
      attributeProbe = { source: "attributeProbeCaptures", status: !observed ? "unverified" : probe.changedPixels > 0 ? "recorded-rgb-change" : "recorded-rgb-invariant",
        changedPixels: probe.changedPixels, maxByteDifference: probe.maxByteDifference,
        perturbedBindings: probe.changes.map((entry) => entry.attribute),
        newExporterUniforms: probe.programs.map((program) => program.newExporter),
        scope: "recorded live-input defaults only; exported branch and visual parity unverified" };
    }
    return {
      guid, name, catalogSection,
      liveMesh: { source: "mesh", status: mesh.status, criteria: "recorded finalized-live-mesh rules; includes family-specific hull criteria", inputSha256: native.mesh.sha256 },
      exportAccessors: { source: "exports", status: exported.status, colorSpaceModel: data.exports.nativeColorSpaceModel,
        glbSha256: exported.glbSha256, droppedUvComponents: exported.droppedComponents.map(({ attribute, component }) => ({ attribute, component })),
        bakerMappingFound: exported.bakerMappingFound, semanticEquivalence: "unverified" },
      fixturePostLoader: { source: "postLoader", status: loaded.status, shaderMeshes,
        pbrMeshes: loaded.meshes.length - shaderMeshes, generator: loaded.generator,
        colorChecks: loaded.meshes.map((item) => item.colorConversion.status), semanticEquivalence: "unverified" },
      normalExportPostLoader: { source: "postLoader", status: normalMeshes.length ? "observed-by-material-name" : "unverified",
        identity: "name-derived join; original stroke GUID provenance unverified", meshes: normalMeshes,
        producingUnityRevision: "unverified", fullPluginPath: "unverified", visualParity: "unverified" },
      browserCapture: { source: "captures", status: capture.status, coverageSmoke: capture.renderStatus,
        generatedUv0Size: capture.generatedUv0Size, shaderUv0Size: capture.shaderUv0Size,
        browserImageSha256: capture.browserSha256, referenceImageSha256: capture.referenceSha256,
        consoleErrors: capture.consoleErrorCount, pageErrors: capture.pageErrorCount,
        inputProfile: capture.inputProfile, nativeContextAlignment: "unverified", visualParity: "unverified" },
      bufferLayout: { source: "layout", status: layout.status, generatedStates: layout.checks, layouts: layout.layouts,
        nativeIncrementalMeshEquivalence: "unverified" },
      assetLoadAudit: "unverified", browserShaderCompileAudit: compileStatus,
      browserShaderCompileEvidence: compile ? { source: "compileCaptures", captureStatus: compile.status,
        context: compile.shaderCompileAudit.context, expectedMaterialPasses: compile.shaderCompileAudit.expectedMaterialPasses,
        observedMaterialPasses: compile.shaderCompileAudit.observedMaterialPasses, boundPrograms: compile.shaderCompileAudit.programs.length,
        shaderSemantics: "unverified", coverageSmoke: compile.renderStatus } : null,
      actualXrShaderCompile: "unverified",
      emulatedXrShaderCompile: xr ? "recorded-emulated-session-link" : "unverified",
      emulatedXrShaderEvidence: xr ? { source: "emulatedXr", emulator: xr.emulator, runtimeVersion: xr.emulatorVersion,
        programs: xr.audit.programs.length, passesByCamera: xr.materialPassesByCamera,
        cameraPositions: xr.cameraPositions, viewerEyes: xr.viewerEyes,
        projectionLayerMatches: xr.renderStateLayerMatches,
        layerPolyfillEnabled: xr.emulatorLayerPolyfillEnabled,
        nativeLayersFeatureGrant: xr.enabledFeatures.includes("layers"),
        physicalDeviceResult: "unverified", visualParity: "unverified" } : null,
      unboundAttributeDefaultProbe: attributeProbe,
      physicalQuestInteraction: "unverified", devicePerformanceBudget: "unverified", animationParity: "unverified",
      visualParity: "unverified",
    };
  });
}
