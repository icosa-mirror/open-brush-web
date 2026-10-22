import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { it, expect } from "vitest";
import { compareAssetTrees } from "./check-brush-asset-regeneration.mjs";

it("compares exact binary bytes and detects missing or stale generated files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brush-regeneration-test-"));
  const expected = path.join(root, "expected"), generated = path.join(root, "generated");
  try {
    for (const directory of [expected, generated]) fs.mkdirSync(path.join(directory, "assets"), { recursive: true });
    for (const directory of [expected, generated]) fs.writeFileSync(path.join(directory, "assets/same.bin"), Buffer.from([0, 255, 128]));
    expect(compareAssetTrees(expected, generated, ["assets"]).differences).toEqual([]);
    fs.writeFileSync(path.join(generated, "assets/same.bin"), Buffer.from([0, 255, 129]));
    fs.writeFileSync(path.join(expected, "assets/stale.bin"), "old");
    fs.writeFileSync(path.join(generated, "assets/new.bin"), "new");
    const result = compareAssetTrees(expected, generated, ["assets"]);
    expect(result.differences.map(row => [row.file, row.status])).toEqual([
      ["assets/new.bin", "missing-checked-in"], ["assets/same.bin", "different"], ["assets/stale.bin", "missing-generated"],
    ]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
