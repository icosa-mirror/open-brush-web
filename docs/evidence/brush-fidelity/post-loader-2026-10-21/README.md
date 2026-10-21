# Post-loader attribute inspection: 2026-10-21

1. [results.json](results.json) records 97 files inspected in Chrome
   155.0.8059.85: all 95 required native fixture GLBs plus two existing normal
   Open Brush exports. [summary.json](summary.json) joins every required GUID
   to its fixture hash and observed normal-export meshes. All fixture hashes
   match the previously checked native export inputs. The installed maintained
   bundle, runner, helper and lockfile hashes identify the code used.
2. A dedicated empty IWSDK world initializes `AssetManager`; loaded objects
   are inspected without attaching them to the world. The helper records
   decoded attribute hashes, counts, dimensions, normalization, aliases, index
   and material groups before and after the installed `three-icosa` `afterRoot`
   hook. The maintained shader-loader cache is shared across these files.
   `beforeRoot` is not registered: external image URI files are rejected. No
   raw GLTFLoader, private AssetManager hook or forced exporter flag is used.
3. All 95 fixture GLBs were inspected without browser errors. Forty-five receive
   maintained shader materials; 50 retain PBR materials because their fixture
   names/extensions do not select brush replacement. Their fixture generator
   marker leaves the new-exporter flag false. Counting the latter 50 as brush
   shader coverage would be incorrect.
4. Existing `Untitled_86.glb` and `brush_cafe_experimental.glb` files from the
   user's `Documents\Open Brush\Exports\...\newglb` directories retain their
   actual `Open Brush UnityGLTF Exporter 2.0.0.)` markers. The larger file has
   99 meshes, all receiving maintained shader materials with the new-exporter
   flag true. Matching `ob-<name>` materials against the required inventory's
   export-manifest names maps these normal exports to 90 required GUIDs; this
   is a name-derived join, not original per-stroke GUID provenance.
   WaveformParticles, Drafting, DuctTapeGeometry, Digital and Race
   remain unverified on that path. The small export also contains two ordinary
   model meshes which keep their PBR materials. Producing native revisions and
   export settings are unknown. Only hashes/attribute observations are published,
   not the user's GLB bytes or geometry.
5. Across all files, 146 bound color attributes match an independently computed
   linear-to-sRGB RGB conversion and byte quantization, with unchanged alpha
   quantization. No color shape/value mismatch or nonfinite attribute/index
   value was found. There were no startup, page or console errors. Warnings
   remain recorded in the raw run's counts; a source shader declaration alone
   does not prove an active GPU input, and differing vector widths may use
   glTF/GL defaults. No compile or semantic-equivalence pass is assigned.
6. Earlier app-initialized exploratory runs stalled on shader fetches; one
   Electricity run reported `ERR_NETWORK_ACCESS_DENIED`. Those runs are rejected
   as successful evidence. The empty-world run with a shared loader completed;
   this does not establish a root cause or fix for the app-initialized failure.
   Logs and rejected runs remain under `.tmp/export-inspection-*` locally.
7. TypeScript and the full repository check passed: 81 Vitest files, 574 passed
   tests and four existing TODOs. This diagnostic does not prove `beforeRoot`,
   actual app GLB import integration, complete production-export coverage,
   shader compilation, rendering, animated deformation or Unity visual parity.

Check `npx iwsdk xr status` before starting an owned dev server. If one already
exists, pass its Vite URL with `--url`. To inspect embedded normal exports or
fixture GLBs:

```powershell
npm run inspect:brush-exports -- --input 'C:\path\example.glb' --output .tmp/new-export-inspection
```

Repeat `--input` for more files. The output directory must be new. Without
`--url`, the driver owns a temporary Vite server on port 4191 and stops only that
server. Shader assets use the existing mirror mode. The report's application
revision `9e3b574` is the pre-change baseline; producing runner/helper hashes
identify this change. Normal exports require local user files to reproduce;
their native producing provenance remains open.
