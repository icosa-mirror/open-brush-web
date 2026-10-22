# Selection canvas and parent lifecycle: 2026-10-22

1. Selected layer-local strokes now use one temporary frame per paint layer
   beneath the selection canvas. Frames preserve the layer basis without
   rewriting control points. Deselection restores the original paint parent;
   empty frames are released after their children have left. Selected strokes
   use selection-canvas visibility, including strokes from hidden paint layers.
2. The pinned IWSDK still writes raw entity indices into generation-aware ECS
   parent fields. `TransformParentCompatibilitySystem` preserves the SDK parent
   accessor and then calls the public ECS setter to store a packed reference.
   It subscribes to Transform lifecycle events, replays existing entities,
   preserves pending declared parents, and releases its accessors/subscriptions
   on detach/destruction. It adds no per-frame repair scan. No installed SDK
   source, dependency versions, textures or extraction configuration changed.
   This is application compatibility, not an upstream SDK fix. Remove the
   adapter only after the unadapted SDK passes the lifecycle regression.
3. [parent-lifecycle-results.json](parent-lifecycle-results.json) checks 16
   destroy/reuse cycles, immediate and post-frame ECS references, both ECS and
   Object3D parenting paths, reparenting away, registration over existing
   entities, new declared parents, and Transform detach/reattach.
4. [selection-results.json](selection-results.json) runs production panel
   commands/history and selection/batching systems. It checks explicit groups,
   posed and hidden layers, unchanged world poses, equal world movement, pending
   save versus reinsertion, undo/redo, private fallback meshes, selection-canvas
   visibility and ten select/deselect cycles. All temporary frames are released.
5. [layer-runtime-results.json](layer-runtime-results.json) reruns the composed
   scene/layer integration with the adapter: transformed authoring, picking,
   selection movement, batching and native pose encoding retention. All three
   browser runs pass with zero console/page errors or graphics warnings.
6. Full local checks pass: 635 tests and four TODOs. Typechecking, the mirror
   build and the full application browser material smoke test also pass.
   [manifest.json](manifest.json) binds reports, code and check logs to the
   implementation baseline. Older failed selection diagnostics are historical;
   only the successful final runs are retained here.

This establishes the tested desktop application behavior. It does not establish
native image agreement, native widget semantics, actual controller gestures,
physical Quest behavior or hardware performance budgets. The independent
[unadapted SDK diagnostic](../recycled-parent-2026-10-22/README.md) remains valid.

After typechecking and checking `npx iwsdk xr status` before each new driver,
reproduce in fresh output directories:

```powershell
node scripts/browser-layer-state.mjs --harness scripts/transform-parent-harness.html --output .tmp/new-parent-lifecycle
node scripts/browser-layer-state.mjs --harness scripts/group-selection-harness.html --output .tmp/new-selection-canvas
node scripts/browser-layer-state.mjs --harness scripts/layer-transform-harness.html --output .tmp/new-layer-runtime
```
