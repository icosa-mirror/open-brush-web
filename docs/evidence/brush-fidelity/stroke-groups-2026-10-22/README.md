# Native save groups and undo continuation: 2026-10-22

1. Native `SketchWriter.StrokeExtension.Group` stores a uint32 selection-group
   tag; zero means `SketchGroupTag.None`. `StrokeFlags.IsGroupContinue` instead
   links adjacent strokes into an undo action. These are independent contracts.
   Web authoring previously assigned a new selection-group ID for every action.
   It now uses zero for newly authored ordinary and symmetry strokes, while
   keeping symmetry continuation flags and the existing history operation.
2. Imported selection tags retain their complete uint32 value in ECS. The
   pinned ECS provides signed Int32 and Float64 stores but no Uint32 store;
   Float64 represents all uint32 values exactly. Imported continuation flags
   also populate the corresponding runtime component field.
3. `visibleStrokeSnapshots` mirrors native
   `SketchWriter.EnumerateAdjustedSnapshots`: retain erased finalized strokes
   while sorting command order, promote a surviving continuation when its lead
   was erased, then omit erased strokes. A surviving mirror no longer joins the
   preceding unrelated undo action after saving. Snapshot-only flag adjustment
   preserves runtime source flags for undo/redo. Hidden layers remain governed
   by logical stroke visibility rather than rendered visibility.
4. Six regressions cover the native writer's five documented erase patterns,
   a preceding unrelated action, unknown high flag bits, an explicit high group
   tag and restoration of an erased lead. Binary save/read retains the high tag
   and adjusted flags.
5. [browser-results.json](browser-results.json) runs actual layer, batch,
   authoring and history systems in an isolated desktop browser. The actual
   library collection method is invoked with those production stroke queries;
   the library's gallery UI is not initialized. Synthetic authoring/finalization
   creates a symmetry pair with selection tags `[0, 0]`. Undo/redo affects both.
   Imported tag `0xf1234567` remains `4045620583`, and its continuation component
   is true. Erasing the new pair's lead yields saved flags `[0, 2, 0]`, with the
   imported explicit tags intact through `.tilt` save/reload. Restoring the lead
   restores the original continuation state. Browser errors and graphics
   warnings are zero.
6. Full checks passed: 92 files, 624 tests and four TODOs; the mirror build
   passed. [manifest.json](manifest.json) binds the report, producing sources,
   regression/check logs and pinned native source files. The producing baseline
   before these changes was `23e56c0`. Collection occurs for save/export or
   snapshots; the correction adds no per-frame scan or cache.

This proves the named source/file/runtime contracts, not native Editor
import/undo behavior or complete grouping parity. Native group editing UI,
group-aware selection/erase behavior, connected-peer group workflows, gallery
interaction and physical XR require separate acceptance evidence. Existing
explicit group tags remain preserved; no legacy tags are silently reclassified.

After typechecking and checking `npx iwsdk xr status`, use a new output directory
(pass `--url` to reuse an existing Vite server):

```powershell
node scripts/browser-layer-state.mjs --harness scripts/stroke-groups-harness.html --output .tmp/new-stroke-groups-run
```
