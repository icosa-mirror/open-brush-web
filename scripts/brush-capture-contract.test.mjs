import { describe, expect, it } from "vitest";
import { validateBrushCapture, validateShaderCompileAudit } from "./brush-capture-contract.mjs";

const audit = () => ({ status: "linked", context: "nonimmersive", expectedMaterialPasses: 1, observedMaterialPasses: 1, errors: [], programs: [{ materialPass: 0, linked: true, vertexCompiled: true, fragmentCompiled: true }] });
const sample = () => ({ width: 2048, height: 2048, profile: "legacy-screenshot-fixture", coverage: 0, renderStatus: "fail", png: "data:image/png;base64,AAAA", generatedUv0Size: 2, shaderUv0Size: 2, shaderCompileAudit: audit() });
describe("browser image capture contract", () => {
  it("requires attributable compile observations instead of trusting a linked status string", () => {
    expect(() => validateShaderCompileAudit(null)).toThrow("missing or incompatible");
    expect(() => validateShaderCompileAudit({ ...audit(), programs: [] })).toThrow("pass count differs");
    const failed = audit(); failed.programs[0].fragmentCompiled = false;
    expect(() => validateShaderCompileAudit(failed)).toThrow("compile/link audit failed");
    expect(() => validateShaderCompileAudit({ ...audit(), expectedMaterialPasses: 3 })).toThrow("status differs");
  });
  it("retains zero or partial observations as unverified and rejects XR-context substitution", () => {
    expect(() => validateShaderCompileAudit({ ...audit(), status: "unverified", expectedMaterialPasses: 3 })).not.toThrow();
    expect(() => validateShaderCompileAudit({ ...audit(), status: "unverified", observedMaterialPasses: 0, programs: [] })).not.toThrow();
    expect(() => validateShaderCompileAudit({ ...audit(), context: "xr-presenting" })).toThrow("missing or incompatible");
  });
  it("accepts 2D/3D/4D UV layouts and rejects packed channels replaced by the 2D alias", () => {
    for (const width of [2, 3, 4]) expect(() => validateBrushCapture({ ...sample(), generatedUv0Size: width, shaderUv0Size: width }, 2048, false)).not.toThrow();
    expect(() => validateBrushCapture({ ...sample(), generatedUv0Size: 4, shaderUv0Size: 2 }, 2048, false)).toThrow("UV0 layout");
    expect(() => validateBrushCapture({ ...sample(), generatedUv0Size: undefined }, 2048, false)).toThrow("UV0 layout");
  });
  it("retains legitimate empty renders as diagnostic data", () => {
    expect(() => validateBrushCapture(sample(), 2048, false)).not.toThrow();
  });
  it("rejects missing/NaN GPU coverage instead of skipping the PNG-loss check", () => {
    expect(() => validateBrushCapture({ ...sample(), coverage: NaN }, 2048, false)).toThrow("coverage is missing");
    expect(() => validateBrushCapture({ ...sample(), coverage: undefined }, 2048, false)).toThrow("coverage is missing");
  });
  it("rejects an old runtime or a native-input request that silently used the legacy fixture", () => {
    expect(() => validateBrushCapture({ ...sample(), profile: undefined }, 2048, false)).toThrow("input profile");
    expect(() => validateBrushCapture(sample(), 2048, true)).toThrow("must be native-capture");
  });
  it("rejects wrong dimensions and incomplete image output", () => {
    expect(() => validateBrushCapture(sample(), 1024, false)).toThrow("dimensions differ");
    expect(() => validateBrushCapture({ ...sample(), png: "data:," }, 2048, false)).toThrow("PNG capture");
  });
});
