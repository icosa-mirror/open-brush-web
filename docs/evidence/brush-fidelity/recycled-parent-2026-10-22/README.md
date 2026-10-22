# Recycled parent references: dependency defect, 2026-10-22

1. [browser-diagnostic.json](browser-diagnostic.json) reproduces the defect using
   only `World`, `Transform` and normal entity lifecycle/public setters. It does
   not import application selection systems. A fresh parent resolves correctly.
   The child is moved away, its parent is destroyed, and the same slot is reused
   at generation 1. Setting the new parent resolves immediately and stores
   `16777227` (slot 11 plus generation bits). After framework updates the field
   contains `11`; ECS resolution fails although the Object3D still has the new
   parent. Console/page errors and graphics warnings are zero. The diagnostic's
   `passed` flag means the defect reproduced, not that parenting is correct.
2. Installed IWSDK core 0.4.2 has two raw-index writes in
   `dist/transform/transform.js`: the Object3D parent setter and TransformSystem's
   parent-adoption fallback. Installed elics 3.4.2 reads `Types.Entity` values
   through `getEntityByPackedRef` and writes them through `packEntityRef`.
   Its references encode eight generation bits and 24 index bits. Losing the
   generation makes recycled parents unresolved. Inspecting the published
   declared-minimum elics 3.4.1 package confirms it also uses packed references;
   this is not solved by pinning to the SDK range's minimum version.
3. [manifest.json](manifest.json) binds the diagnostic, driver, lockfile,
   installed dependency source/package hashes, the inspected 3.4.1 archive and
   typecheck log. The app baseline was `cfc2968`. The source checkout for IWSDK
   has been requested. No installed/generated dependency source was edited, no
   dependency was downgraded, and no package reference changed.
4. A pending selection-canvas implementation exposed the issue when temporary
   layer frames were released and reused. Its initial batched parent/visibility,
   composed movement and pending/reinserted save checks passed, but the private
   mesh probe remained beneath an unresolved recycled parent. Those failed
   application runs remain diagnostics under `.tmp/selection-canvas-*`; none is
   accepted as complete selection rendering evidence. The implementation stays
   uncommitted at this diagnostic checkpoint. Subsequent
   [selection acceptance](../selection-canvas-2026-10-22/README.md) uses an
   application compatibility layer without editing installed dependency source.
5. The framework fix must preserve packed references in both paths while
   retaining Object3D entity indices for APIs that use indices. Acceptance must
   verify immediate and post-frame ECS parent resolution, reparenting away from
   a reused entity, and repeated destroy/reuse cycles. Then rerun the pending
   production selection, private/batched geometry, hidden-layer visibility,
   world-pose, movement, save/reinsertion and cleanup checks. Retaining frames
   forever or avoiding slot reuse does not establish the required lifecycle.

This evidence identifies a dependency failure. It closes no native image,
selection rendering, physical XR or application-parity gate. Existing successful
baseline CI does not exercise this minimal recycled-parent sequence.

After typechecking and checking `npx iwsdk xr status`, reproduce in a new output
directory (pass `--url` to reuse an existing Vite server):

```powershell
node scripts/browser-layer-state.mjs --harness scripts/recycled-parent-harness.html --output .tmp/new-recycled-parent-diagnostic
```

The current diagnostic expects the failure and should stop matching after the
framework is fixed. Add a positive lifecycle regression for the corrected
behavior rather than treating successful reproduction as a passing feature.

The later application adapter preserves the SDK parent setter and stores the
parent through the public ECS setter after each assignment, with lifecycle
replay/cleanup. Its positive regression covers repeated reuse and detach/reattach;
selection acceptance is recorded separately. The original unadapted failure and
this diagnostic's meaning are unchanged.
