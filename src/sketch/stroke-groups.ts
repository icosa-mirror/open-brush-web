import { StrokeFlags, type StrokeData } from "../types.js";

/** Mirrors SketchWriter.EnumerateAdjustedSnapshots. Input must include erased
 * finalized strokes, in command order, so a surviving continuation can become
 * the lead of its original undo action. Selection group IDs are independent. */
export function visibleStrokeSnapshots(strokes: Iterable<{ data: StrokeData; visible: boolean }>): StrokeData[] {
  const result: StrokeData[] = [];
  let resetContinuation = false;
  for (const { data, visible } of strokes) {
    const flags: number = resetContinuation ? (data.flags & ~StrokeFlags.IsGroupContinue) >>> 0 : data.flags;
    resetContinuation = false;
    if (visible) result.push(flags === data.flags ? data : { ...data, flags: flags as StrokeFlags });
    else resetContinuation = (flags & StrokeFlags.IsGroupContinue) === 0;
  }
  return result;
}
