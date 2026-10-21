# Desktop shader compile/link audit: 2026-10-22

1. [results.json](results.json) records all 95 required brushes through the
   application's corrected geometry-capture route, using Chrome
   155.0.8059.85/ANGLE SwiftShader. All **99 observed programs/material passes**
   have successful vertex compile, fragment compile and program link statuses.
   Electricity contributes three passes; Toon and Tube Toon Inverted contribute
   two each. All other brushes contribute one. No console/page errors occurred.
2. The one-shot audit assigns unique cache keys to the capture's disposable
   material clones, so an earlier cached program cannot supply the result.
   During the synchronous render it observes actual `useProgram` arguments and
   queries each program and attached shader. It attributes observations to the
   current material pass and records active attributes and bound item sizes.
   This also sees automatic front/back bindings when they occur. Original GL
   methods, debug callbacks/settings, mesh callbacks and material cache keys
   are restored in `finally`. Live drawing is not instrumented.
3. [gpu-controls.json](gpu-controls.json) records the shipped control runner:
   a valid shader followed by a deliberately invalid fragment shader in the
   same context. The valid program links; the invalid program reports failed
   fragment compile/link. Both restoration checks pass, with no page errors.
   The invalid shader is expected negative evidence, not a passing compile.
   An earlier managed-shell runner exited without a result; only completed
   host-PowerShell control runs are accepted here.
4. All 95 PNG captures succeeded at unchanged 2048x2048 reference dimensions.
   Coverage remains **94/95**: the legacy planar ConcaveHull input is empty.
   Its shader still compiles/links. The collector consequently returns exit
   code 1 for the coverage failure, while retaining the successful compile
   observations. Compile/link, nonempty coverage and Unity visual agreement
   are separate states; no image-parity pass is assigned.
5. Eight active `gl_VertexID` observations correctly have no geometry buffer.
   Six unbound user-attribute observations remain for semantic review:
   Electricity's three passes report `a_texcoord2`; Disco, BubbleWand and
   KeijiroTube report `a_texcoord1`. A linked program can retain an attribute
   used only by a uniform-controlled branch. These observations do not prove
   the live branch consumes missing data, and no fabricated buffers were added.
   Linking does not prove correct packing or shader branch inputs.
6. [manifest.json](manifest.json) binds the producing source, build bundles and
   per-brush logs to hashes. The raw report's app revision `f086d11` is the
   pre-change baseline; producing source hashes identify this change. Raw PNG
   pairs/logs remain at `.tmp/brush-images-compile-audit`. The reference corpus
   was not regenerated or resized. The ledger checks its per-GUID hashes.
7. TypeScript, the mirror production build and repository checks passed. The
   full check before adding the standalone control source had 83 Vitest files,
   586 tests passed and four existing TODOs; the added control source then
   passed type checking and its real browser control run. Metadata regressions
   reject missing audits, failed shaders, fabricated pass counts, incomplete
   pass sets labelled linked, and XR-context substitution.

This proves desktop compile/link for the programs bound in this recorded
nonimmersive capture context. It does not prove every runtime shader variant,
actual XR compilation, physical device behavior, performance, active-input
semantics, matched native rendering context or visual parity. Fresh program
creation and GL introspection make these captures unsuitable for performance
measurement.

Run type checking and `npx iwsdk xr status` first. When no runtime is running,
the GPU control command owns a temporary Vite server on port 4193:

```powershell
npm run test:browser:shader-compile -- --output .tmp/new-shader-control
```

For the 95-brush run, build the current mirror production bundle and use
`npm run compare:brush-images` with the unchanged native PNG directory and a new
output directory. Existing Vite/preview URLs can be supplied with `--url`.
These commands use software rendering, not Quest timing or headset validation.
