import { expect, it } from "vitest";
import { createEmptyStrokeData, StrokeFlags } from "../types.js";
import { visibleStrokeSnapshots } from "./stroke-groups.js";
import { readSketchMemory, writeSketchMemory } from "./sketch-memory.js";

it.each([
  [[true, true, true], [false, true, true]],
  [[false, true, true], [false, true]],
  [[true, false, true], [false, true]],
  [[true, false, false], [false]],
  [[false, false, true], [false]],
])("matches the native writer's erased-group case %j", (visible, expected) => {
  const candidates = visible.map((shown, i) => ({ visible: shown,
    data: createEmptyStrokeData({ guid: `${i}`, flags: i === 0 ? StrokeFlags.None : StrokeFlags.IsGroupContinue }) }));
  const original = JSON.stringify(candidates);
  const snapshots = visibleStrokeSnapshots(candidates);
  expect(snapshots.map(stroke => !!(stroke.flags & StrokeFlags.IsGroupContinue))).toEqual(expected);
  expect(JSON.stringify(candidates)).toBe(original);
});

it("retains selection tags and other flag bits without attaching a surviving mirror to the preceding action", () => {
  const prior = createEmptyStrokeData({ guid: "prior" });
  const lead = createEmptyStrokeData({ guid: "lead", groupId: 0xf1234567 });
  const mirror = createEmptyStrokeData({ guid: "mirror", groupId: lead.groupId, flags: 0x80000002 as StrokeFlags });
  const candidates = [{ data: prior, visible: true }, { data: lead, visible: false }, { data: mirror, visible: true }];
  const snapshots = visibleStrokeSnapshots(candidates);
  expect(snapshots.map(stroke => stroke.flags)).toEqual([0, 0x80000000]);
  const payload = writeSketchMemory(snapshots);
  const loaded = readSketchMemory(payload.bytes, payload.brushGuids);
  expect(loaded[1].groupId).toBe(lead.groupId);
  expect(loaded[1].flags).toBe(0x80000000);
  candidates[1].visible = true;
  expect(visibleStrokeSnapshots(candidates).map(stroke => stroke.flags)).toEqual([0, 0, 0x80000002]);
});
