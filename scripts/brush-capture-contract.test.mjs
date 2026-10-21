import { describe, expect, it } from "vitest";
import { validateBrushCapture } from "./brush-capture-contract.mjs";

const sample = () => ({ width: 2048, height: 2048, profile: "legacy-screenshot-fixture", coverage: 0, renderStatus: "fail", png: "data:image/png;base64,AAAA" });
describe("browser image capture contract", () => {
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
