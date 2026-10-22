import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexGuidRows, joinBrushFidelityEvidence, requireMatchingHash } from "./brush-fidelity-evidence.mjs";

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url)));
const base = "docs/evidence/brush-fidelity/";
const data = {
  generation: read(`${base}native-2026-10-21/manifest.json`),
  mesh: read(`${base}native-2026-10-21/live-mesh-comparison.json`),
  exports: read(`${base}export-accessors-2026-10-21/results.json`),
  postLoader: read(`${base}post-loader-2026-10-21/results.json`),
  captures: read(`${base}browser-images-packed-uv-2026-10-21/results.json`),
  layout: read(`${base}vertex-layout-2026-10-22/results.json`),
  images: read(`${base}native-2026-10-21/image-corpus-inventory.json`),
};
const required = data.exports.brushes.map((row) => ({ guid: row.guid, name: row.name }));

describe("per-GUID brush fidelity evidence join", () => {
  it("records clean active emulator sessions separately from physical-device compilation and rejects graphics warnings", () => {
    const changed = { ...data, emulatedXr: read(`${base}emulated-xr-shader-compile-2026-10-22/results.json`) };
    const rows = joinBrushFidelityEvidence(required, changed);
    expect(rows.filter(row => row.emulatedXrShaderCompile === "recorded-emulated-session-link")).toHaveLength(95);
    expect(rows.every(row => row.actualXrShaderCompile === "unverified" && row.visualParity === "unverified")).toBe(true);
    changed.emulatedXr.graphicsWarningCount = 1;
    expect(() => joinBrushFidelityEvidence(required, changed)).toThrow("browser/graphics errors");
  });
  it("keeps four controlled default-input probes separate from visual parity and requires a sensitivity control", () => {
    const changed = { ...data,
      attributeProbeCaptures: read(`${base}attribute-default-probe-2026-10-22/results.json`),
      attributeProbeControls: read(`${base}attribute-default-probe-2026-10-22/gpu-controls.json`),
    };
    const rows = joinBrushFidelityEvidence(required, changed);
    expect(rows.filter((row) => row.unboundAttributeDefaultProbe?.status === "recorded-rgb-invariant")).toHaveLength(4);
    expect(rows.every((row) => row.visualParity === "unverified")).toBe(true);
    changed.attributeProbeControls = null;
    expect(() => joinBrushFidelityEvidence(required, changed)).toThrow("sensitivity/restoration control");
  });
  it("records complete browser link audits without promoting XR or visual parity", () => {
    const changed = structuredClone(data);
    changed.compileCaptures = { results: changed.captures.results.map((row) => ({ ...row,
      shaderCompileAudit: { status: "linked", context: "nonimmersive", expectedMaterialPasses: 1, observedMaterialPasses: 1,
        errors: [], programs: [{ materialPass: 0, linked: true, vertexCompiled: true, fragmentCompiled: true }] },
    })) };
    const rows = joinBrushFidelityEvidence(required, changed);
    expect(rows.every((row) => row.browserShaderCompileAudit === "recorded-linked")).toBe(true);
    expect(rows.every((row) => row.actualXrShaderCompile === "unverified" && row.visualParity === "unverified")).toBe(true);
    changed.compileCaptures.results[0].shaderCompileAudit.expectedMaterialPasses = 3;
    expect(() => joinBrushFidelityEvidence(required, changed)).toThrow("status differs");
    changed.compileCaptures.results[0].shaderCompileAudit.status = "unverified";
    expect(joinBrushFidelityEvidence(required, changed).find((row) => row.guid === changed.compileCaptures.results[0].guid).browserShaderCompileAudit).toBe("unverified");
  });
  it("retains 95 recorded matches without promoting capture/coverage to visual parity", () => {
    const rows = joinBrushFidelityEvidence(required, data);
    expect(rows).toHaveLength(95);
    expect(rows.every((row) => row.liveMesh.status === "match")).toBe(true);
    expect(rows.every((row) => row.visualParity === "unverified" && row.actualXrShaderCompile === "unverified")).toBe(true);
    const concave = rows.find((row) => row.name === "ConcaveHull");
    expect(concave.browserCapture.status).toBe("captured");
    expect(concave.browserCapture.coverageSmoke).toBe("fail");
    expect(concave.browserCapture.visualParity).toBe("unverified");
  });

  it("retains PBR paths and absent normal-export coverage as separate states", () => {
    const rows = joinBrushFidelityEvidence(required, data);
    expect(rows.filter((row) => row.fixturePostLoader.shaderMeshes > 0)).toHaveLength(45);
    expect(rows.filter((row) => row.fixturePostLoader.pbrMeshes > 0)).toHaveLength(50);
    expect(rows.filter((row) => row.normalExportPostLoader.status === "unverified")).toHaveLength(5);
    expect(rows.find((row) => row.name === "Race").normalExportPostLoader.status).toBe("unverified");
  });

  it("rejects duplicate, malformed or missing GUID evidence instead of partial publication", () => {
    const guid = required[0].guid;
    expect(() => indexGuidRows([{ guid }, { guid: guid.toUpperCase() }], "guid", "test")).toThrow("Duplicate test GUID");
    expect(() => indexGuidRows([{ guid: 123 }], "guid", "test")).toThrow("Invalid test GUID");
    const changed = structuredClone(data);
    changed.layout.brushes = [];
    expect(() => joinBrushFidelityEvidence(required, changed)).toThrow("Missing layout evidence");
  });

  it("rejects cross-report fixture/image hash drift and missing provenance hashes", () => {
    expect(() => requireMatchingHash(undefined, undefined, "test")).toThrow("hash differs or is missing");
    for (const stage of ["layout", "captures", "exports"]) {
      const changed = structuredClone(data);
      const row = stage === "captures" ? changed.captures.results[0] : changed[stage].brushes[0];
      row[stage === "layout" ? "sha256" : stage === "captures" ? "referenceSha256" : "glbSha256"] = "0".repeat(64);
      expect(() => joinBrushFidelityEvidence(required, changed)).toThrow("hash differs or is missing");
    }
  });
});
