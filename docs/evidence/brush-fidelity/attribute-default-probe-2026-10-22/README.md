# Unbound user-attribute branch probe: 2026-10-22

1. The desktop link audit found six user-attribute observations without geometry
   bindings across four brushes. The captured compiled vertex sources below
   guard those reads with `u_isNewTiltExporter`. The new probe reads the actual
   uploaded GPU uniform after material setup: it is **false for all six programs**.
   BubbleWand additionally reports `u_isTiltInput=true`; the other programs do
   not have an active uniform with that name.
2. Immediately before each draw, the probe changes only disabled, unbound float
   user-attribute defaults from their observed values to
   `[8192.5, -6144.25, 12345.75, -3.5]`, then restores the original values in
   `finally`. GL draw methods and the mesh callback are also restored. No
   geometry buffers are fabricated, and built-ins are excluded. Baseline and
   perturbed images use the same generated geometry, camera, fixed shader time,
   owned materials and linked programs in one synchronous capture operation.
3. All four 2048x2048 baseline captures are nonempty, all six material passes
   compile/link, and there are **zero changed RGB bytes** after perturbation.
   The comparison includes every pixel regardless of alpha and detects even a
   one-byte RGB change. [results.json](results.json) records the actual defaults,
   supplied values, GPU flags and compiled vertex source; [manifest.json](manifest.json)
   binds source/build/log hashes. Raw PNGs/logs remain in
   `.tmp/attribute-probe-brushes`. The native reference corpus was unchanged.
4. [gpu-controls.json](gpu-controls.json) includes a shader deliberately consuming
   an unbound `a_probe` input. Perturbation changes eight of its 16 pixels, with
   maximum byte difference 255; attribute defaults and hooks are restored.
   This sensitivity control prevents an insensitive probe from masquerading as
   evidence. Valid/invalid shader compile controls also pass their expected
   outcomes. No page or unexpected browser errors occurred in the brush probes.
5. The compiled source guards, actual false exporter flags and controlled
   invariance support leaving these inputs unbound in the recorded live-input
   branch. This is not a claim that the corresponding exported-mesh values are
   correct. That branch has different baked inputs and remains separate work.
   The probe does not establish all shader-input semantics, animation, runtime
   variants, actual XR behavior or Unity visual parity. No live drawing or
   shader arithmetic was changed by this investigation.
6. Full repository checking passed: 84 Vitest files, 589 tests and four existing
   TODOs. Unit regressions cover zero-alpha additive RGB, byte-level differences,
   alpha-only changes and malformed buffers. The real GPU sensitivity/restoration
   control, mirror production build and four brush captures passed. The ledger
   records four probes and explicitly leaves the other 91 unverified.
7. The raw app revision `aefe5d6` is the pre-change baseline. Producing source
   hashes in the manifest identify this change. The `.glsl` files are the actual
   captured compiled vertex sources, not hand-reconstructed shader examples.

| Brush | Unbound user input | Programs | Captured source |
| --- | --- | --- | --- |
| Electricity | `a_texcoord2` | 3 | [pass 0](Electricity-pass0.vert.glsl#L220), [pass 1](Electricity-pass1.vert.glsl#L220), [pass 2](Electricity-pass2.vert.glsl#L220) |
| Disco | `a_texcoord1` | 1 | [source](Disco-pass0.vert.glsl#L112) |
| BubbleWand | `a_texcoord1` | 1 | [source](BubbleWand-pass0.vert.glsl#L237) |
| KeijiroTube | `a_texcoord1` | 1 | [source](KeijiroTube-pass0.vert.glsl#L110) |

After type checking, checking `npx iwsdk xr status`, and building the current
mirror bundle, reproduce with a new output directory:

```powershell
npm run compare:brush-images -- --references 'C:\Users\andyb\Documents\open-brush-fast\Support\Screenshots\brushes-postfx-disabled' --output .tmp/new-attribute-probe --attribute-probe --brush Electricity --brush Disco --brush BubbleWand --brush KeijiroTube
```

`npm run test:browser:shader-compile -- --output <new directory>` now also runs
the active-unbound-input sensitivity control. These are one-shot desktop
diagnostics; their GL queries and second render are not performance measurements.
