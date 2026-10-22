# Explicit group selection membership: 2026-10-22

1. Native `SelectCommand` expands explicit tags using
   `SelectionManager.StrokesInGroup`; the latter returns geometry-enabled group
   members. `SelectionTool` restricts the initial hit to the active canvas,
   while expansion can include members on other canvases. Ungrouped targets
   are selected individually. Native eraser hits queue individual strokes for
   deletion rather than selecting whole groups; that behavior is unchanged.
2. The web panel's Select Last command now passes the resolved eligible target
   through `resolveStrokeSelectionGroup`. Explicit groups expand to visible,
   finalized members across layers. Render visibility and active-layer rules
   choose the target rather than filtering its group. Zero/absent tags select
   only the target. No per-frame group scan or cache was added.
3. Two regressions cover high uint32 tags, other/hidden-layer membership,
   erased/unfinished exclusions, other tags and zero/absent tags. Existing
   selection tests remain passing.
4. [browser-results.json](browser-results.json) runs the actual PanelSystem,
   command history and production authoring/layer/batch/selection systems in
   an isolated desktop browser. Commands are called directly; no panel UI
   entities or controller clicks are involved. A group spanning the active
   layer and a hidden/locked layer selects both active members, excluding an
   erased member and a different group. Selection summary reports two members
   and mixed layers. Undo/redo restores the whole membership; clear-selection
   undo restores it too. A subsequent ungrouped target selects alone. Console,
   page and graphics errors are zero.
5. Full checks passed: 92 files, 626 tests and four TODOs; the mirror build
   passed. [manifest.json](manifest.json) binds the evidence, producing source,
   test/check logs and native source files at the declared pin. The app
   baseline before these changes was `a6a6fb9`.

Membership agreement is separate from native selection rendering. Native
selection reparents strokes into its selection canvas; web selected meshes
currently retain their paint-layer parents. Hidden-layer appearance during
selection therefore remains a known implementation gap. Spatial selection
input, widget-group expansion, group editing UI, native image agreement and
physical XR also remain open. This evidence does not close complete grouping
or application parity.

After typechecking and checking `npx iwsdk xr status`, use a new output directory
(pass `--url` to reuse an existing Vite server):

```powershell
node scripts/browser-layer-state.mjs --harness scripts/group-selection-harness.html --output .tmp/new-group-selection-run
```
