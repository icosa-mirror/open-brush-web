import { describe, expect, it } from "vitest";
import { selectRequiredFixtures } from "./compare-unity-mesh-fixtures.mjs";

describe("required Unity fixture coverage", () => {
  it("selects GUIDs from the web inventory and explicitly permits native catalog extras", () => {
    const selected = selectRequiredFixtures([
      { guid: "BBBB", file: "second.mesh.json" },
      { guid: "cccc", file: "native-extra.mesh.json" },
      { guid: "aaaa", file: "first.mesh.json" },
    ], new Set(["aaaa", "bbbb"]));
    expect(selected.map((record) => record.file)).toEqual(["first.mesh.json", "second.mesh.json"]);
  });
  it("rejects an incomplete required inventory", () => {
    expect(() => selectRequiredFixtures([{ guid: "aaaa" }], new Set(["aaaa", "bbbb"]))).toThrow("Missing 1 required fixture");
  });
  it("rejects duplicate GUIDs instead of letting them inflate coverage", () => {
    expect(() => selectRequiredFixtures([{ guid: "aaaa" }, { guid: "AAAA" }], new Set(["aaaa"]))).toThrow("Duplicate required fixture GUID");
  });
  it("rejects an empty target rather than reporting a vacuous pass", () => {
    expect(() => selectRequiredFixtures([], new Set())).toThrow("inventory is empty");
  });
});
