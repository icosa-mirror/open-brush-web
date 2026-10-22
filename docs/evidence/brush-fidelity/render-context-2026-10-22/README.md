# Loaded custom lights and fog: 2026-10-22

1. Native metadata defines byte-valued ambient/fog colors and HDR directional
   colors, with light orientations in scene space. The parser copies supported
   fields, normalizes and reflects rotations into the renderer basis and records
   malformed known fields as issues. Original archive metadata is untouched.
   Library document replacement applies the custom context or resets defaults.
   Shared uniform holders retain their identities for existing/late materials.
2. Native `SceneSettings.FogDensity` divides density by scene pose scale.
   Standard.asset specifies `0.0025` per native decimetre. Maintained `ApplyFog`
   multiplies density by ten for metre-space vertices. The web shader's previous
   `0.00025` and environment geometry's `0.0025/m` each produced ten times less
   fog than that source contract. Defaults are now `0.0025` before the shader
   helper and `0.025/m` for geometry, each divided by scene world scale. A zero
   custom density remains zero. Exponential geometry fog retains its existing
   shader chunk; its color uses the stock material's sRGB-to-linear convention.
3. Light matrices compose the scene's world rotation with native scene-local
   orientations before camera conversion. Uniform scene scaling does not
   multiply directional light strength. Default color and light-local matrix
   values remain the existing maintained-viewer convention. Native pixel and
   color-space agreement still require calibrated captures.
4. [browser-results.json](browser-results.json) checks the actual document
   context method with production layer, authoring and environment systems.
   A synthetic native file supplies ambient bytes, HDR light color `[4,2,1,1]`,
   identity native light rotations and fog density `0.0014`. With scene scale 2
   and a 90-degree Y rotation, shader density is approximately `0.0007`, scene
   geometry density `0.007`, and light direction `[1,0,0]`. At scale 4 the
   densities halve while direction remains unit length. Explicit zero fog and
   reset to Standard pass. A material arriving later shares the context
   holders. The Standard geometry asset loads. Console/page errors and graphics
   warnings are zero. This inspects rendering inputs/state rather than pixels.
5. [sample-context.json](sample-context.json) uses the public native file adapter
   on the real café sample: zero fog, two custom lights and no known-field parse
   issues. [file-roundtrip.json](file-roundtrip.json) retains all 557 strokes,
   40,641 control points, original metadata values, thumbnail and retained
   archive bytes. The sample bytes remain untracked and are identified by hash.
   These file checks do not prove live native Editor import/render behavior.
6. Three regressions cover byte/HDR colors, handedness, metadata isolation,
   malformed inputs and equal native/shader/geometry fog exponents under scale.
   Full local checks pass: 94 files, 632 tests and four TODOs; the mirror build
   passes. [manifest.json](manifest.json) binds native/runtime source authority,
   reports and checks. The producing application baseline was `2ea80ec`.
   Local checks included the separately listed uncommitted selection files;
   this does not validate their known SDK parent-reference failure.

This implements custom light/fog overrides and their scene-frame application.
Other environment presets still use the Standard geometry/rig as fallback
where overrides are absent. Gradient/skybox/reflection settings remain opaque,
and this run did not cover collaboration. Subsequent protocol version 4
[peer evidence](../collab-render-context-2026-10-22/README.md) verifies transport
of the supported custom fields. Native captures,
color-space calibration, transition-frame images, full preset interpretation
and physical XR remain open. Parsing known fields without issues does not
imply support for all archived environment settings.

After typechecking and checking `npx iwsdk xr status`, use a new browser output
directory (pass `--url` to reuse an existing Vite server):

```powershell
node scripts/browser-layer-state.mjs --harness scripts/render-context-harness.html --output .tmp/new-render-context-run
node scripts/audit-sketch-render-context.mjs --sample brush_cafe_experimental.tilt --output .tmp/new-render-context-sample.json
node scripts/audit-tilt-roundtrip.mjs --sample brush_cafe_experimental.tilt --output .tmp/new-render-context-file-audit
```
