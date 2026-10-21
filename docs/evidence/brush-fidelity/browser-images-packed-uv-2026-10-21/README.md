# Browser capture packed-UV correction: 2026-10-21

The visual-conformance path bound generated 3D/4D `a_texcoord0` and then called
the standard alias helper, replacing it with the ordinary 2D `uv` attribute.
This discarded radius/particle components during capture. The live drawing path
already applied aliases first and packed shader UVs afterward.

The capture path now uses that same ordering. It fails before rendering if the
bound UV0 width differs from the generator's declared width. Both widths are
included in capture metadata, and the collector rejects mismatches or missing
metadata rather than accepting an older runtime. This is a capture-path fix;
it does not change native reference images, generator output or shader source.

1. [results.json](results.json) records all 95 captures at unchanged 2048x2048
   dimensions using the legacy browser fixture. All reference hashes match the
   previous run; no native reference image was replaced or resized. Chrome
   155.0.8059.85 used SwiftShader with the pinned local mirror assets.
2. The run exercised 57 2D, 31 3D and seven 4D UV0 layouts. All 95 bound shader
   widths match their generator widths. The 38 packed-UV brushes now retain
   the correct layout; 14 have changed image hashes relative to the old capture.
   Some 2D images also changed, so image differences alone cannot all be
   attributed to the UV fix. Width equality is recorded independently of pixels.
3. All 95 PNG captures succeeded without console/page errors. Ninety-four
   passed the coverage smoke check; the legacy planar ConcaveHull case remains
   empty. Accordingly, the collector returned exit code 1, correctly retaining
   that failed smoke check. It is not an all-green render or parity run.
4. [manifest.json](manifest.json) records the producing source hashes, build
   index/bundle hashes, per-log hashes and per-GUID width observations. The
   application revision in the raw report is the pre-change baseline `42dbc91`;
   the source hashes identify the producing changes in this commit. Raw image
   pairs and logs remain in `.tmp/brush-images-packed-uv-fixed`. Representative
   corrected captures are [Smoke](Smoke-browser.png) and
   [LightWire](LightWire-browser.png).
5. TypeScript, the production mirror build and the full repository check
   passed: 81 Vitest files, 575 tests passed and four existing TODOs. Contract
   regression coverage accepts matching 2D/3D/4D layouts and rejects missing
   metadata or a 4D layout replaced by a 2D shader alias.

Native stroke/camera, lighting and rendering-context alignment remain
unverified. No Unity visual parity pass or calibrated image-error threshold
follows from this fix. The general runtime vertex contract, supplemental channel
validation and incremental-authoring equivalence remain separate unfinished
work; the live drawing path already had the correct UV binding order.
