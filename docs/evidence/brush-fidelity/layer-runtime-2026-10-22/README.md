# Layer rendering and tool coordinates: 2026-10-22

1. Paint-layer entities now live under the shared scene pose and apply their
   own TRS. Private/mirrored/preview stroke meshes and batch meshes use the
   matching layer parent. Generator control points, brush size and packed shader
   inputs stay layer-local. The tool selection canvas stays under the shared
   scene pose. Saving reads each layer's current local pose; GLB nodes carry
   the pose separately from mesh geometry. Pose equality accounts for native/
   runtime Float32 storage, preserving unchanged original native encodings.
2. [browser-results.json](browser-results.json) runs actual IWSDK production
   layer, authoring, batch and selection systems in an isolated headless Chrome
   world. A scene translation/rotation/scale composes with two different layer
   poses. The independent expected world point `[-0.6, 0.4, -3.8]` agrees within
   `1e-5`. Private and batch parents are checked; the posed batch world-space
   sphere hit succeeds. Two batches exist before the authored stroke is added.
3. Synthetic world tip input produces the expected local sample position
   `[0.1, 0.2, 0.3]`, identity local orientation and brush size `0.02` under a
   total world scale of 3. Tool broadphase returns that same local point and
   scale; picker size includes both layer and scene scales. Actual authoring
   finalization and undo/redo operate on the created stroke. These calls use
   diagnostic projections of private methods, not controller gestures.
4. Selection bounds agree with an independent eight-corner transform into the
   widget parent's space. A widget displacement `[0.2, -0.1, 0.3]` moves both
   selected layers by the same expected world displacement `[0.15, 0.3, 0.45]`.
   Batch reinsertion preserves the expected local saved-point offset
   `[-0.15, -0.05, 0.1]`; a translated world-space batch hit still succeeds.
5. A synthetic right-hand tip anchor and normal frame updates exercise preview
   switching to the second layer. The preview reparents correctly, samples
   `[0.4, 0.5, 0.6]` locally and uses world scale `0.75`. The reparent frame
   clears/hides the old trail before new samples. Document clearing now disposes
   the old preview before its layer entities are removed; that cleanup wiring
   is source-reviewed, not a new retained-memory budget measurement.
6. Console errors, page errors and graphics warnings are zero. Earlier runs
   stopped on missing fixture settings or checked a new entity before its
   parenting frame; they remain rejected raw diagnostics under
   `.tmp/layer-transform-runtime*`. Only the final preview-inclusive run is
   accepted, including the check that a pose survives actual runtime Float32
   fields without rewriting its original encoding. Its browser/server logs
   remain in `.tmp/layer-transform-runtime-final`.
7. [file-results.json](file-results.json) repeats the café audit: all 557 decoded
   native strokes, 40,641 points, original metadata values and retained archive
   bytes remain unchanged. That real sample has no nonidentity layer pose.
   A GLB regression verifies the layer's TRS while comparing exported binary
   mesh bytes and accessors with the unposed export; they remain identical.
   Full checks passed: 88 files, **611 passing tests**, four existing TODOs;
   the mirror production build passed. [manifest.json](manifest.json) binds
   reports, GLB sources and check/build log hashes.

This is deterministic system/file validation, not native image parity or
end-to-end UI evidence. Real controller gestures, eraser/picker UI, connected
collaboration layer context, layer-editing UI, room/canvas/media transforms,
native widget layers, physical XR and resource/performance budgets remain open.
No real nonidentity native layer sample or fresh Editor capture was available;
the native Editor still awaits recovery of its detected scene backup. Existing
global symmetry behavior is not promoted to native multi-layer symmetry parity.
The [integration plan](../../../native-layer-transform-integration.md) retains
the remaining acceptance gates. The producing app baseline was `c517cf4` before
these edits; per-file hashes identify the actual producing code.

After type checking and checking `npx iwsdk xr status`, reproduce in a new output
directory (use `--url` to reuse an existing Vite server):

```powershell
node scripts/browser-layer-state.mjs --harness scripts/layer-transform-harness.html --output .tmp/new-layer-transform-runtime
node scripts/audit-tilt-roundtrip.mjs --sample brush_cafe_experimental.tilt --output .tmp/new-layer-transform-file-audit
```
