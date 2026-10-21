# Open Brush parity plan and brush fidelity review

Current planning audit: 2026-10-21, application baseline `4d1f736`.

Original review: 2026-08-31, application baseline `4579dbb`.

Open Brush: [`4786d55ad398bfc957d8e8eb26438920026aeaf6`](https://github.com/icosa-foundation/open-brush/tree/4786d55ad398bfc957d8e8eb26438920026aeaf6)

Open Brush mesh-fixture generator: `b05324dbd` on `feature/brush-fixtures`

## Current planning baseline

The planning update reconciled the report with application source and recorded
batching validation. A subsequent fresh Unity mesh-fixture run on 2026-10-21 now
provides the live-mesh evidence linked below. Browser-image comparisons and
headset tests have not been rerun by that work. Detailed brush-family notes also
retain earlier investigation; do not treat every historical imperative as
unfinished or expand a live-mesh result into other kinds of parity.

| Input | Current configured revision | Authority |
| --- | --- | --- |
| Open Brush reference | `4786d55ad398bfc957d8e8eb26438920026aeaf6` | [open-brush-reference.json](open-brush-reference.json); local `reference/` HEAD matches |
| `three-tiltloader` | `6c92f0035911e8e61755fec3270beb7604d5dc81` | [package.json](package.json), [package-lock.json](package-lock.json) |
| `three-icosa` | `25fe4ca1f7e52174e7d9dca90c811e307216ba1f` | [package.json](package.json), [package-lock.json](package-lock.json) |
| `icosa-sketch-assets` | `df593c972751f7f28bc8d47bc4f4fd8cfad45fe5` | [brush-asset-base-url.ts](src/brushes/brush-asset-base-url.ts); immutable default URL, explicit environment override/mirror |

The older dependency hashes in the recovery history describe earlier reviewed
revisions, not today's installed pins. Pin alignment is checked by
`npm run check:pins`; alignment alone does not establish conformance or approve
every intervening upstream change.

| Area | Current implementation/evidence | Remaining parity requirement |
| --- | --- | --- |
| Target inventory | Generated metadata contains 48 standard and 47 non-broken experimental catalog brushes; [brush-catalog.ts](src/brushes/brush-catalog.ts) derives the required set. | Keep compatibility-only imports distinct from the 95-brush painting target. |
| Geometry | [brush-geometry.ts](src/brushes/brush-geometry.ts) delegates to `three-tiltloader`. The [fresh native run](docs/evidence/brush-fidelity/native-2026-10-21/README.md) matches 95/95 required live meshes against current package pins, under family-specific rules. | The fresh native revision is `5591ff1`, distinct from the declared reference pin. Cover incremental rebuilds, animated deformation, and export paths separately; reconcile reference provenance explicitly. |
| Materials | Shared maintained assets and [render-pass helpers](src/brushes/brush-render-material.ts) are wired into the app; late material upgrades are registered. | Unity-reference image comparisons, loaded-environment context, audio analysis, and physical-Quest validation remain open. |
| Labels and evidence | [Inventory labels](src/brushes/brush-inventory.ts) derive `supported` and `likely-mostly-correct` from implementation eligibility. [Shader evidence](src/brushes/brush-shader-compatibility.ts) persists asset/browser/immersive-XR/visual contexts locally. | Join eligibility with revisioned mesh/image/device evidence; a selectable brush or a local `ready` record is not a parity verdict. |
| Production batching | [StrokeBatchRenderSystem](src/systems/stroke-batch-render-system.ts) is registered in [src/index.ts](src/index.ts); [batching is default-on](src/brushes/stroke-batch-feature.ts), with `?strokeBatches=0` or `false` as the opt-out. | Follow the [batching validation ledger](docs/stroke-batching-validation.md): broader brush/view coverage, context loss, latency/capacity budgets, and physical-headset evidence remain open. |
| File handling | Local [tilt-file.ts](src/sketch/tilt-file.ts) and [sketch-memory.ts](src/sketch/sketch-memory.ts) still implement archive and stroke serialization; gallery imports use the local reader. | Shared geometry migration is complete in the adapter; parser consolidation and native Open Brush round-trip compatibility are separate unfinished work. |

## Validation boundaries

1. `npm run check` runs pin alignment, TypeScript, import/feature checks, image
   metric unit tests, and Vitest. Its success is not a Unity image or live-mesh
   comparison. This document update does not require rerunning those checks.
2. `npm run test:browser:materials` exercises installed Chrome with the material
   readiness/compile checks, Oil Paint A/B and real-stroke coverage, and focused
   Electricity/Toon rendering. Nonempty output and bump/control differences do
   not prove agreement with Unity's pixels.
3. `npm run test:browser` and `npm run test:xr` currently check runtime
   connectivity and, for XR, an active session. Their names must not be read as
   automated interaction, image-conformance, or physical-headset suites; see
   [runtime-check.mjs](scripts/runtime-check.mjs).
4. `npm run compare:unity-meshes -- --fixtures <directory> --output <report.json>`
   wraps the installed package comparator with required-GUID coverage checks,
   immutable input snapshots and revision/hash evidence. The fresh native run
   regenerated 100 JSON/GLB pairs at
   `C:\Users\andyb\Documents\open-brush-fast\Support\BrushFixtures`; all 95 current
   required GUIDs match. Five additional native brushes are reported outside the
   current target. See [run evidence](docs/evidence/brush-fidelity/native-2026-10-21/README.md).
   The native revision was `5591ff1aad5288903e718752c522d54420ae6d1e`, not the
   report's `4786d55` reference pin. Generation also produced post-BrushBaker
   stages and GLBs; those stages were not compared by this live-mesh run.
5. The user supplied the existing Unity image corpus at
   `C:\Users\andyb\Documents\open-brush-fast\Support\Screenshots\brushes-postfx-disabled`.
   All 95 PNG filenames match the required brush names; every image is
   **2048x2048**. These files are untracked in that checkout, whose current HEAD
   is `5591ff1aad5288903e718752c522d54420ae6d1e`; that HEAD does not establish
   which revision produced the images. The pinned screenshot generator and
   browser conformance route target 1024x1024. Establish capture provenance and
   explicitly match resolution/render settings before comparing; do not silently
   resize or replace this corpus. [compare-brush-images.mjs](scripts/compare-brush-images.mjs)
   provides metrics, not an automated current 95-brush Unity/browser comparison.
   The adjacent `brush-ssim-current.txt` records 95 pairs, but identifies neither
   input set in its header; it is not attributable browser-parity evidence yet.
   An [image inventory](docs/evidence/brush-fidelity/native-2026-10-21/image-corpus-inventory.json)
   now binds all 95 existing PNGs to hashes and dimensions without attributing
   unverified capture settings or a producing revision. The current native
   `UiScreenshotter` explicitly requests 2048x2048, 1x supersampling and 1x MSAA
   for post-effects-disabled material captures; the pinned source differs.
6. The batching ledger records desktop and emulated-stereo observations,
   including connected peers, delayed material arrival, selection/history,
   save/reload, and ten cleanup cycles. Those observations do not prove physical
   Quest interaction, GPU memory budgets, or all-brush behavior.

## Executive assessment

Open Brush web is a functional WebXR painting application derived from Open Brush concepts and assets. It is not currently a faithful port of Open Brush's brush runtime.

The strongest mapping is the data and live-mesh layer: all 123 extracted GUIDs are present, shader and texture assets have been extracted, and the main `.tilt` stroke fields are represented. The required fidelity target matches Open Brush's authored picker catalogs: 48 standard brushes plus 47 experimental brushes. Four additional experimental entries are tagged `broken`, and 24 uncatalogued compatibility records remain loadable for old sketches but are not port requirements. All 95 required brushes now have shared geometry paths in `three-tiltloader` and pass the current deterministic Open Brush live-mesh fixture criteria. That result covers the fixture strokes and attributes described below; it does not establish post-BrushBaker, exported GLB, browser-image, incremental-authoring, or XR parity.

Catalog scope and runtime visibility are independent of fidelity classification:

| Set | Count | Actual meaning |
| --- | ---: | --- |
| Standard catalog | 48 | Shown in manifest order, 12 per page |
| Experimental catalog | 47 | The 51 extracted experimental records minus four entries tagged `broken` |
| Required total | 95 | The only brushes required for fidelity work |
| Compatibility/non-catalog | 24 | Retained for old sketches, excluded from the port backlog |
| Broken experimental | 4 | CandyCane, HolidayTree, Snowflake, and Braid3; excluded by Open Brush's tag filter |

All 95 required buttons are visible. Brushes classified as **Likely mostly
correct** remain selectable; brushes classified as **Unverified or likely
substantially wrong** are visibly marked and disabled rather than silently routed
through generic fallback rendering. All 95 required catalog entries now have an
implemented mesh/material contract and are enabled; the disabled distinction
continues to apply to unsupported compatibility-only records.

The 123 asset records contain 74 handcrafted and 49 template shaders, and report 112 resolved texture bindings with none missing. Those are asset-pipeline coverage figures, not fidelity figures.

There is no measured overall parity percentage. The earlier percentage estimates
have been withdrawn from the active plan: catalog coverage, fixture matches,
material appearance, and application behavior have different denominators and
cannot be combined into a credible product score. The fresh deterministic
live-mesh result is 95/95 against current package pins and the native source
revision identified above, under family-specific criteria. It is not a
visual-parity result or proof against every Open Brush revision.

## What maps well

1. Brush GUIDs, manifest values, shader parameters, textures, descriptor tags, pressure ranges, and several geometry settings are data-driven.
2. All 95 required brushes currently resolve materials through pinned `icosa-sketch-assets` and `three-icosa` revisions, and `three-tiltloader` supplies the reusable mesh generators. The current Open Brush web pins use the reviewed dependency revisions described below; quarantined integration branches are excluded. The intended local material adapter is limited to IWSDK-compatible material construction, frame uniforms, diagnostics, and compatibility-only fallbacks.
3. Color, brush GUID, size, scale, flags, seed, group, layer, pose, pressure, and timestamp are represented.
4. Authoring includes keeper/trailing-point sampling and a pressure-dependent spawn interval.
5. Non-raw `ShaderMaterial` is a sensible WebXR adaptation because it permits super-three's GLSL3 and multiview rewriting.
6. Generated production assets do not require a Unity checkout at runtime.

## Mesh-generation gaps

### Generator coverage

Open Brush has 32 C# files under `Assets/Scripts/Brushes`. Open Brush web currently maps:

- Four quad-strip/flat classes to one `ribbon` generator.
- `TubeBrush` and several derived contracts to a parameterized `tube` generator.
- Three particle classes to dedicated deterministic particle generators.
- `SquareBrush` to a hard-edged rectangular-prism specialization of the tube builder.
- `ThickGeometryBrush` to its six-vertex belly-strip topology.
- `HullBrush` to tetrahedron inputs followed by convex-hull generation, with
  source faceted and angle-weighted smooth-normal output modes.
- `ConcaveHullBrush` to overlapping five-knot hulls built from its
  pressure-sized, controller-oriented quill segments.
- `Square3DPrintBrush` to capped manifold rounded-square rings with its source
  bevel, cap fan, orientation validity, and section-break rules.
- Everything else to unsupported or unmapped.

No required catalog generator remains unmapped. SquarePaper now emits SquareBrush's four hard-edged sides, 0.375 cross-section aspect, caps, and constant center UVs. ThickGeometry now emits the source six-vertex ring, eight-triangle segment, endpoint belly pinch, distance UV, normals, tangents, and GeometryBrush pressure smoothing. ShinyHull, MatteHull, UnlitHull, DiamondHull, and SmoothHull now use the source tetrahedron knot conversion, convex envelope, 3D UV contract, and faceted/smooth vertex modes. ConcaveHull uses the source five-knot sliding window and QuillPen conversion. 3D Printing Brush emits capped, manifold eight-vertex rounded-square rings with independently smoothed start/end sizes and source-smoothed knot centers. Compatibility-only blocks, holiday, braid, SVG, PBR/environment, and other special generators are retained for old sketches but are outside the 95-brush target.

### Knot and sampling semantics

Open Brush generators consume knots containing raw and smoothed pose/pressure,
frame state, length, breaks, geometry ranges, and deterministic RNG state. Live
web authoring now uses descriptor solid-minimum length, pressured-size spacing,
minimum motion, and the source distance-smoothed pressure (including the shorter
M11 window) when deciding whether to extend or keep a trailing point. Spray and
Genius particle constructors explicitly disable that smoothing and retain raw
pressure. Live keeper spacing dispatches the authored formulas for
ribbon/tube/flat/thick, Spray/Midpoint Spray, Genius particles, 3D Print, and
convex/concave hull generators. QuadStrip retains its 1.5 mm solid minimum;
Flat/Thick/Printable/Square use 2 mm and Tube/hulls consume their descriptor
value. Finalized generators also reconstruct the pressure and position
smoothing documented below.
Remaining cross-generator gaps are adjacent-knot rebuild/restart behavior,
generator-specific finalization beyond empty-geometry discard, and vertex-limit
splitting. Local strokes with no generated triangles are discarded before
history, mirroring Open Brush's no-used-geometry rule while retaining valid
single-particle strokes.

Serialized `brushScale` is now applied to local ribbon width, tube radius and
modifiers, particle size, bounds, and distance-UV density. This matches Open
Brush's `brushSize * brushScale` conversion from pointer to canvas space.

### Ribbons

Dependency recovery note: shader-side fidelity changes described in the generator
sections below were implemented on quarantined `icosa-sketch-assets` and
`three-icosa` integration branches. They remain useful diagnostic evidence, but
they are not accepted upstream progress and must not be retained by modifying the
verified shader corpus. Re-establish each result by correcting generated vertex
data, bindings, uniforms, render state, or Open Brush web render composition against
the trusted dependencies. Geometry work in `three-tiltloader` remains the primary
reusable implementation path.

The local ribbon now distinguishes distance, stretch, and unitized UV modes; uses
physical length and tile rate where required; selects atlas rows deterministically;
emits explicit hue-shifted backfaces; and supplies normals and tangents. Generated
Unity UVs are converted to the glTF convention consumed by the exported shaders.
Sub-millimetre moves and direction reversals now split the indexed strip, with
distance/stretch UVs restarted per section. Important remaining differences are:

- FlatGeometry brushes now honor their extracted distance/stretch UV style;
  DuctTapeGeometry no longer falls through to stretch UVs.
- FlatGeometry tangents now come from the source triangle/UV gradient rule
  rather than the stroke direction, restoring the intended tangent basis for
  normal-mapped flat brushes at bends.
- Ribbon pressure now uses Open Brush's distance-based smoothing window,
  including the shorter M11 FlatGeometry window and its forced zero-pressure
  initial knot in both finalized geometry and live keeper state.
- Non-M11 FlatGeometry's second pass now smooths each section's final rendered
  center toward the following non-rendered break knot, while retaining the
  unsmoothed terminal width used by Unity.
- Remaining position/frame differences, discard, and adjacent-knot rebuild
  rules are incomplete. Non-M11 `FlatGeometryBrush` strokes clip
  self-intersections and cap width growth against raw knot travel before the
  source second-pass edge smoothing. On finalization they also trim rendered
  geometry after a late break when fewer than six knots remain, while retaining
  the serialized control points as Unity does.
- Distance, stretch, and unitized QuadStrip brushes now emit Open Brush's
  explicit six-vertex triangle-soup solids, including separate backface solids.
  Solids use the source segment-centered `PositionQuad` frame, uniform current
  smoothed-pressure width, color interpolation, and vector-offset contract.
  DistanceUV variants apply the source byte-quantized 25 mm beginning/leading
  opacity ramp after fused solid lengths are known. Their U progression replays
  the source newest-three-solid updates using each append's pressured width and
  current averaged edge lengths.
  StretchUV sections normalize U from those final averaged left/right solid
  lengths before rebuilding tangent space.
  Finalized geometry also reconstructs the source backward midpoint/fusion pass,
  fused-edge normals, and triangle-derived tangent space. Provisional leading
  edges and incremental late-knot replacement remain incomplete.
- QuadStrip sharp bends now carry the source edge-crossing size adjustment,
  projected forward vector, `m_LastSizeShrink` state, and distance recovery
  into subsequent solids.
- Finalized local and collaboration QuadStrip strokes now apply the source
  `GetNumUsedVerts` cleanup using the retained keeper/trailing-point state;
  live provisional tips and keeper-only imported strokes remain visible.
  Broader head/tail simplification for other generators remains incomplete.
- DoubleTapered and Electricity now consume the emitted edge-vector layout.
  Electricity also recreates the Unity shader's three displacement passes;
  exact `FlatGeometryBrush` smoothing/topology remains open.
- SingleSided and DoubleFlat now use the Unity diffuse-texture cutout path in the
  approved maintained shaders. Browser smoke verifies that both loaded fragments
  retain the texture sample, vertex-alpha cutoff, and discard contract.
- Space still uses the maintained web shader's three-octave value-noise
  substitute. The Unity 2D/3D simplex-noise basis and six-octave
  `0.516`-persistence FBM remain an upstream asset gap.
- Toon now recreates its radius-packed, front-culled black outline pass. Its
  blue surface remains too narrow against the Unity reference, so exact tube
  radius/topology is still required.
- TubeToonInverted now opts into its Unity black base and inverse-scale inflated
  color passes, including object-space normal-y shading. The maintained shader's
  default pass value preserves its former one-pass output for consumers that do
  not request the new passes.

### Tubes

The parallel-transport tube now consumes extracted side count, end-cap, hard-edge,
UV-style, cap-aspect, atlas, radius-packing, taper, and petal settings. It carries
Open Brush's distance-based pressure smoothing into radius, opacity, and petal
displacement, uses
circumference-dependent distance UVs, emits tangents, and splits/caps sections
using Open Brush's minimum-motion and width-relative frame-angle tests. Remaining
differences are:

- Cap/ring topology has not been byte-compared against each upstream `TubeBrush` variant.
- `SquareBrush` now uses its source flat rectangular start/end faces and 16
  duplicated corner vertices per solid instead of inheriting pointed TubeBrush
  cap tips that extended the stroke bounds. Its rings also remain on raw
  control-point positions rather than inheriting TubeBrush center smoothing,
  and use `ComputeSurfaceFrameNew` with the current knot's pointer orientation.
  Breaks depend on raw movement angle and pressured size, so pointer roll alone
  does not split a straight solid.
- Hard-edged tube rings now use Open Brush's radial tangent channel instead of
  the stroke-forward tangent, restoring the authored tangent basis for their
  normal maps.
- A break-delimited Tube section now rebuilds its retained back ring from the
  following valid knot's frame, matching the source rather than retaining the
  broken incoming segment's orientation.
- Distance-UV Tube sections now restart their deterministic atlas row at each
  break, and each end cap inherits the V range of its own ring.
- Finalized Tube knot centers use the source three-point smoothing filter;
  incremental adjacent-knot rebuild semantics remain absent.
- Sin, comet, taper, petal, and double-taper modifier progress now restarts for
  each break-delimited Tube section, as does StretchUV knot progression.
  StretchUV reproduces the source overwrite pass: its final two rings share
  `(N - 1) / N`, and cap U values retain the documented Unity limitation.
  Double-taper also applies the source trailing-knot partial-progress
  interpolation and short-stroke attenuation against the Tube spawn interval.
  Exact modifier curves still need Unity mesh-dump validation.
- Disco and LightWire consume the radius-packed 3D UV0 tube contract; exact Unity deformation still needs fixture comparison.
- Rain now uses Unity's 2.25-radius strip separation and exact `_Time.y * 4`
  scroll/randomization rates instead of the maintained web shader's reduced
  bulge and 30%-speed compensation.
- Culling and seam behavior need per-brush visual validation.

### Particles

The seven `GeniusParticlesBrush` entries now create deterministic finalized
particles at the source `0.0025 / particleRate` distance interval. Placement
uses the source salt layout, pressure sizing/floor, size variance, spherical
spread, random orientation/alpha, and atlas selection. Their GeometryBrush
constructor disables pressure smoothing, so size and opacity use raw knot
pressure. They pack center,
rotation, birth time, source position, and vertex ID into the Open Brush
normal/UV contract and render through their handcrafted export shaders, which
restore camera billboarding and texture animation. A browser pixel gate renders
generated Smoke geometry through that shader and rejects empty or black output.
Live Genius strokes keep points at the source `0.0025 / particleRate` interval
and add the source pointer-hanging particle, which finalization removes before
the stroke becomes persistent. Finalized two-knot strokes rebuild only their
last particle with Unity's minimum 0.8 trigger pressure, including segments
that spawned multiple particles. Preview birth times use the source negative-time
encoding, and six maintained Genius shaders now shrink those particles with the
source quadratic curve over the shared 0.2-second preview lifetime. Rising
Bubbles now ports its Unity vertex behavior: exponential origin spread,
rising/jitter displacement, lifetime dimming, rotated camera billboarding, and
the same preview shrink contract. Bubbles, Snow, and Stars now move from the
packed source position to their randomized center using Unity's exponential
spread curve. Dots and Smoke intentionally retain their Unity shaders'
non-spreading `ParticleVertex_t` paths. Bubbles, Embers, and Snow ramp their
animated displacement by the same spread progress; Embers' packed origin and
center coincide, but its separate scrolling displacement still ramps in. Smoke
now uses the Unity shader's curl-only motion with the source spatial frequency,
time rate, and displacement scale instead of the former web-specific jitter.

The seven `SprayBrush` entries now spawn segment-oriented quads at the source
pressure-sized interval, including the 500-quad segment cap, source salt
layout, size/position/rotation/alpha variance, size ratio, atlas selection,
raw knot pressure, explicit backfaces, and real default-vertex export shaders.
A Splatter pixel
gate rejects empty or black generated output. Preview decay remains
approximate, although preview control points now use the same pressure-sized
keeper interval and trailing-point extension as persistent strokes. They use
Open Brush's shared 0.2-second lifetime and preserve the source decayed-knot
salt offset as expired knots are removed. Genius particles also retain the
removed distance modulo their spawn interval, matching the source length-cache phase.
Live Spray and Midpoint Spray strokes use `pressuredSize / sprayRateMultiplier`
instead of the ribbon/tube keeper formula.

The three `MidpointPlusLifetimeSprayBrush` entries now use the same authored
distance spawning and segment frame, plus their distinct five-quad salt layout
and 4D UV1 corner-offset/birth-time contract. Midpoint preview rebuilds restart
that salt layout from the rebuilt knot indices rather than carrying the
decayed-knot offset used by Spray and Genius. Unlike Spray and Genius, Midpoint
retains GeometryBrush's distance-smoothed pressure for live keeper spacing,
spawn count, size, and opacity. DanceFloor now exposes the generated UV1 birth
time through the scalar `a_timestamp` binding used by its maintained shader,
restoring its lifetime color/normal pulse input.
WaveformParticles retains its birth-time-driven curl displacement.
HyperGrid now reproduces
Unity's lifetime-dependent transition from its fine birth grid to its
particle-size grid; its additional audio-reactive behavior remains absent. Finalized loaded
Midpoint and Genius particle strokes now use Open Brush's deterministic zero
birth time, while live-authored strokes retain timestamps in the same
level-relative time domain supplied to shader `u_time`. Preview decay uses that
same origin through its accumulated frame deltas. Imported sketches therefore
retain Open Brush's zero-birth animation policy without inheriting an arbitrary
browser/system clock offset. A remote live stroke keeps its peer-relative
particle timing but receives one fixed offset when first observed, aligning its
newest birth to the receiver's level clock without sliding phase on later
progress updates.

### Performance

Finalized strokes remain separate meshes and draw calls, and frustum culling is
disabled. Active geometry now uploads only its used vertex and index ranges
rather than each geometrically grown buffer's full capacity. `brush-batching.ts`
has tests but no production caller. Large Open Brush sketches still need pooled
material batches, separate dynamic active-stroke buffers, deformation-aware
culling bounds, and erase/undo compaction.

## Shared dependency architecture

Open Brush web should not own private copies of reusable Open Brush parsing, geometry, shader assets, or material bindings. The intended source-of-truth split is:

- [`three-tiltloader`](https://github.com/icosa-foundation/three-tiltloader) owns `.tilt` archive/binary parsing, the stroke and control-point data model, brush-manifest interpretation, and reusable static and incremental mesh generators. Its lowest geometry layer should return typed arrays plus attribute/index descriptions without depending on Three.js; an optional adapter can construct `BufferGeometry`.
- [`icosa-sketch-assets`](https://github.com/icosa-foundation/icosa-sketch-assets) supplies the maintained Three.js-compatible GLSL and brush textures. Consume those assets without Open Brush web-specific shader edits. Production and CI must use a pinned revision, but the files need not be vendored or committed to Open Brush web: the browser may load them from stable known URLs, or CI may mirror that revision into a deployment when self-hosting is desired. The asset base URL must be configurable.
- [`three-icosa`](https://github.com/icosa-foundation/three-icosa) supplies brush GUID/name lookup, texture and uniform setup, vertex-attribute binding, render-state selection, and per-frame camera, lighting, fog, and time integration. Use its glTF extension directly for imported glTF sketches.
- Open Brush web owns IWSDK entities/systems, controller sampling, interactive painting, sketch lifecycle, UI, undo/erase, collaboration, and a thin IWSDK/XR adapter. That adapter may select `ShaderMaterial` instead of `RawShaderMaterial` and connect IWSDK/super-three XR multiview state, but it should not duplicate parsing, generators, brush bindings, or shader logic.
- Binding changes that are generally useful should be contributed to `three-icosa` only as backward-compatible, separately reviewed changes. The optional material-factory change is the model: existing construction continues to return `RawShaderMaterial`, while IWSDK can explicitly request a non-raw material. Until that isolated change is restored and downstream-tested, Open Brush web can subclass or wrap `TiltShaderLoader.parse()` locally to adapt the loaded material without changing shader selection, uniforms, textures, or default behavior.
- Parser and generator changes that are generally useful should be contributed to `three-tiltloader`. Its existing incomplete generic-ribbon implementation is prior art, not a compatibility constraint; replace it behind a new API rather than preserving incorrect behavior.
- Dependency updates must be deliberate: record pinned revisions, build distributable assets reproducibly, and run the representative mesh and browser/XR image gates before advancing any pin. Never push Open Brush web integration series directly to a dependency's `main`. Test `gallery-viewer` against the actual modified `three-icosa` checkout, not a neighbouring stale checkout; a successful package build alone is not runtime or visual compatibility evidence.

### Dependency recovery boundary

This subsection records the earlier recovery decisions. Its short hashes are
historical; the full current revisions are listed in the planning baseline.

The Open Brush web-driven dependency series have been preserved for reference on
archived integration branches and removed from the dependencies' default
branches. They are not approved pins.

- Approved `icosa-sketch-assets` revision: `1c06159`. It retains the independently
  reviewed Digital/Race shader fix, removes the unused `brushes/legacy`
  directory, and restores `gl_VertexID` for the six maintained particle shaders.
  The rejected `a_texcoord1.w` corner index from `9e7f3a5` is not present because
  active UnityGLTF UV1 export truncates that component and the binding layer does
  not synthesize it. SingleSided and DoubleFlat now sample their declared diffuse
  textures and apply the Unity alpha-cutout contract. Their current stock textures
  are opaque white, so this restores shader behavior without claiming a visible
  stock-image difference. Electricity exposes the displacement modifier required
  to select its three Unity-equivalent material passes.
- Approved `three-icosa` revision: `6ad0a05`, based on trusted revision
  `1868253`. It retains package exports and declarations, the optional material
  factory hook whose default remains `RawShaderMaterial`, and the Digital/Race
  bindings. It applies generated authoritative color-space and sampler metadata
  by default for every known brush texture; an optional texture configurator
  runs afterward as an override, not as the source of correct defaults. Package
  tests and Gallery Viewer browser rendering pass; Open Brush web's check suite and
  production build pass against the updated pins. It also handles the maintained
  Electricity export variants. The earlier exact
  `three-icosa@ab2cd19` distributable was also built into `gallery-viewer` and
  used there to load and render an existing sketch. Revision `1868253` made the
  required Electricity, Toon, and Tube Toon Inverted material passes normal GLTF
  extension behavior. Gallery Viewer builds from the exact pinned dependency.
  Visible Chrome verifies Tube Toon Inverted with a focused fixture and verifies
  Toon and Electricity within the maintained 48-mesh `all_brushes.glb` sketch.
- Approved `three-tiltloader` revision: `075dcea`. It pins
  `three-icosa@6ad0a05` and contains the ribbon,
  tube, particle, thick-strip, hull, ConcaveHull, and 3D Print fidelity changes.
  Its deterministic comparator reports 95/95 required Open Brush fixtures as
  matches under the family-specific criteria documented below. Changes there
  must continue to reproduce Open Brush contracts rather than require shaders
  to understand a Open Brush web-only layout.

That checkpoint pinned those revisions directly and used
`three-tiltloader@075dcea` for shared geometry generation. Current package and
asset pins have since advanced; do not copy the historical pins into a new change
without reviewing the intervening fixes.
The quarantined integration branches remain diagnostic references only.

This migration does not make the shaders equivalent to the Unity runtime shaders. The maintained web shaders remain ports of Open Brush behavior, and exact fidelity still depends on correct generated vertex contracts, render context, animation inputs, and brush-specific multiple material passes.

Move the implementation upstream incrementally: establish the neutral stroke/geometry result interfaces; move one generator family and its tests; switch Open Brush web to the package; repeat for the remaining families; then move `.tilt` parsing once the shared output model is stable. Delete each Open Brush web copy only after its upstream replacement passes the existing fixtures.

## Material and shader gaps

### Export shaders are not Unity runtime shader parity

`Support/GlTFShaders` contains Open Brush's export/viewer shaders. They are primary-source approximations, but not translations of every Unity runtime pass, keyword, or render state. Forty-nine local shaders are produced from official templates. UI and reports should distinguish handcrafted export shaders, export templates, web fallbacks, and validated Unity-runtime ports rather than calling all of them the "real shader."

All required material lookups use the maintained dependency path. Open Brush web
pins `icosa-sketch-assets@1c06159`, `three-icosa@6ad0a05`, and
`three-tiltloader@075dcea`. Browser smoke testing reports 111/111 materials
loaded with no shader compile errors; Oil Paint links with its 1024x1024 normal
texture bound, and separate render gates reject black or empty output from
Electricity, Toon, and Tube Toon Inverted. Dependency provenance and successful
compilation establish source ownership and browser-render eligibility; they do
not establish Unity image parity.
DanceFloor now binds the live generator's particle birth time from `uv1.w` to
the maintained shader's scalar `a_timestamp` input. LeakyPen correctly retains
the Unity live `QuadStripBrush` UV0-only layout: its binding aliases UV0 to the
maintained shader's `a_texcoord1` name because Unity surface-shader
`uv_SecondaryTex` denotes UV0 transformed by `_SecondaryTex_ST` (UV set 1 would
be named `uv2_SecondaryTex`).
Known brush placeholders now preserve the source opaque/cutout or additive render
state even when stroke color alpha is below one; ordinary alpha blending remains
limited to unknown compatibility fallbacks.
Runtime material loading defaults to the immutable approved `icosa-sketch-assets`
revision on jsDelivr and can be redirected with
`VITE_ICOSA_BRUSH_ASSET_BASE_URL`. The submodule is retained as a conformance
source and for the explicit `assets:brushes:mirror`/`build:mirror` self-hosting
path; ordinary development and production builds no longer copy it.

### Vertex data is the limiting contract

The current gate checks `vertexIsDefault` plus explicit Genius, Spray, Midpoint, HyperGrid, Waveform, DoubleTapered, Electricity, Disco, LightWire, Hull, and 3D-print contracts. Even default shaders only match if attribute values have the correct semantics. No extracted brush remains in the `fallback` classification; 12 compatibility-only special generator records remain `unsupported`, all outside the 95-brush target. HyperGrid renders its non-audio export behavior, but real audio-reactive inputs remain absent. The runtime now supplies position, normal, tangent, color, 2D/3D/4D UV0, 3D/4D UV1, vertex IDs, and index where the selected generator defines those semantics.

The active contract is a pipeline, not a direct copy of Unity UV channels:

1. The live brush creates a mesh described by `GeometryPool.VertexLayout`.
2. `OpenBrushExportPlugin` copies that mesh and passes it through
   `BrushBaker.ProcessMesh`. Brush-specific compute-shader mappings in
   `BrushBaker.prefab` can deform vertices and repack values before export.
3. UnityGLTF serializes the baked result. Positions, normals, and tangents receive
   coordinate conversion; ordinary UV0/UV1 are written as `vec2` with V flipped,
   so wider components are not preserved there; the custom UV2 attribute can
   retain `vec2`, `vec3`, or `vec4` data.
4. Three.js `GLTFLoader` creates standard `BufferGeometry` attributes.
5. `three-icosa` detects the `Open Brush UnityGLTF Exporter` generator, remaps
   those attributes to the shader-facing `a_*` names, performs brush-specific
   aliases, and sets `u_isNewTiltExporter`.
6. The maintained shader files in `icosa-sketch-assets` use that flag to select
   the appropriate packing logic. The deleted `brushes/legacy` shader directory
   was not part of this runtime path.

Electricity demonstrates why all stages matter. BrushBaker bakes the time-zero
displacement into position and packs midpoint XY into UV1 and midpoint Z/width
into UV2. UnityGLTF emits those channels, `three-icosa` maps them to
`a_texcoord1`/`a_texcoord2`, and the maintained shader's new-exporter path reads
the split values and removes the baked displacement before applying animation.
Judging either the live mesh layout or shader source alone gives the wrong
contract.

The extent of live-versus-export differences is therefore brush-specific. Many
unmapped brushes pass through with only ordinary exporter conversion, while the
20 configured BrushBaker mappings and the special `three-icosa` remaps can
change packing substantially. Audit the final shader-facing geometry rather
than assuming a uniform semantic conversion.

The recovery rule is: `three-tiltloader` must reproduce the final contract
expected by the maintained shader and binding path, including component widths,
packing, corner order, indexing, time domain, and exporter flag. Fixtures should
capture the live Unity mesh, post-BrushBaker mesh, exported GLB attributes,
post-`three-icosa` `BufferGeometry`, selected shader branch, and generated
`three-tiltloader` geometry for every mapped/special family.

### Descriptor data is extracted but unused

Records contain tile rate, atlas count, backface settings, radius packing, opacity, audio-reactive flags, color constraints, pressure ranges, and solid minimum length. Ribbon and tube generation now consumes many of these fields, but head/tail rules and several special-generator settings remain metadata only. Thirty-two records are marked audio-reactive, but brush materials have no beat/FFT/waveform input pipeline; draw sounds are a separate feature.

### Texture semantics are flattened

Extraction and loading preserve sRGB/linear intent, per-axis wrapping, filter mode,
mipmap generation, and anisotropy, and runtime `_TexelSize` uniforms now use the
actual loaded image dimensions. The trusted `three-icosa` path supplies authored
texture scale/offset uniforms and applies generated Unity color-space, wrapping,
mipmap, filter, and anisotropy settings as loader defaults for all consumers.
Open Brush web applies the same extracted metadata only on its non-authoritative
fallback material path. Compression/transcoding, platform overrides, mip bias, and
full Unity alpha/import semantics remain unported.
The exported derivative bump branch made lit brushes render entirely black on
physical Quest hardware. A guarded replacement is now the default: it clamps
degenerate gradients and falls back per fragment, passes the Oil Paint pixel A/B
check with a material difference, and renders a real generated Oil Paint stroke
in desktop Chrome without black output. `?bump-mapping=fallback` retains an
explicit flat-normal escape hatch. Physical-Quest verification is still required
before this can be classified as fully validated rather than likely mostly correct.

### Render state and environment are partial

The runtime maps broad blend mode, transparency, and depth write. Three-icosa
now applies the extracted `renderBackfaces` contract to all 95 required brushes,
and the fallback material path uses the same field rather than the conflicting
material `enableCull` flag. Render queue, arbitrary blend factors, ZTest/ZWrite
variants, color masks, alpha-to-coverage, polygon offset, explicit backface
passes, and premultiplied alpha remain unvalidated. Lighting/fog is fixed to one
Standard viewer rig rather than loaded sketch/environment state.

### Diagnostics and extraction regression

Shader loads and warmups record durable per-GUID compatibility results, and existing
fallback meshes are upgraded when their shader material becomes available. The
visual conformance routes now also persist per-GUID pass/fail results with coverage,
timestamp, and runtime identity. The remaining diagnostic gap is a complete
browser/Quest compile and image-comparison matrix tied to the visual reference
corpus. Extraction now writes the catalog consumed by the runtime and checks
generated additive shaders for unresolved emission macros.

## Required fidelity harness

Unit tests cover geometry/comparison utilities, inventory, materials, batching,
and editing/persistence logic; they do not establish Unity visual parity. The
fixture-generation/comparison and browser render pieces described below exist
in part. Complete the connected, revisioned conformance harness so that it:

1. Feeds identical deterministic strokes into Unity and the browser: line, arc, helix, sharp corner, reversal, pressure ramp, twist, dot, long stroke, and segment break.
2. Dumps finalized Unity positions, indices, normals, tangents, colors, UV0-UVn, bounds, and material state for every GUID.
3. Compares topology exactly where the algorithm is ported; otherwise compares surfaces and semantic attributes with declared tolerances.
4. Renders fixed camera/environment fixtures and compares linear images before and after post-processing.
5. Compiles and screenshots on desktop WebGL and immersive XR/Quest.
6. Publishes per-GUID results for mesh contract, browser/XR compile, image error, animation, ordering, and performance.

Do not create a second synthetic visual baseline. The pinned Open Brush checkout
contains the authoritative brush fixture generator at
`Assets/Editor/UiScreenshotter.cs`. The existing image corpus is in the
user-supplied `open-brush-fast/Support/Screenshots/brushes-postfx-disabled`
directory listed in the current baseline (for example `brush-OilPaint.png` and
`brush-DuctTape.png`), not the originally reported local reference path.
`Generate Brush Screenshots` draws the same deterministic
path for every catalog brush, uses the black environment
`580b4529-ac50-4fe9-b8d2-635765a14893`, fixes shader time at 0.5 seconds, disables
post-processing, renders at 2x supersampling with 4x MSAA, and downsamples to
1024x1024 in the pinned source. The supplied PNGs are 2048x2048, so their capture
settings need establishing. Browser reference renders must reproduce the chosen
corpus's path, framing, environment, time, resolution, antialiasing, and
post-processing state before image comparison.

Use IWSDK's live runtime inspection for browser verification. Locate the actual
`BrushStroke` entity by brush GUID, inspect its ECS fields, scene transform,
generated geometry, assigned material, shader uniforms, and compatibility result,
then capture the real application render. A synthetic quad may be used only as a
coarse shader-compilation/effect smoke check; it is not evidence that a generated
brush stroke looks correct. The minimum debugging sequence is typecheck, connect
to the existing IWSDK runtime, inspect the real stroke entity/material, check all
browser logs, and screenshot the live scene.

Suggested gates:

- Do not label a brush `supported` without mesh-contract and browser/XR compile passes.
- Default-picker brushes: SSIM >= 0.97 under two fixed views, with manual alpha/additive review.
- Animated brushes: compare at 0, 0.5, 1, and 2 seconds.
- Quest target: 72 Hz at a documented vertex/stroke budget with bounded draw calls and no first-use shader hitch.

## Improvement plan

### Phase 0: trustworthy baseline (partially implemented)

1. Configured: immutable dependency/asset pins and a pin-alignment check. The
   older `9e7f3a5` recovery discussion is historical. Still bind every fresh
   conformance artifact to the exact app, package, asset, and Unity revisions;
   review upstream deltas instead of treating pin alignment as approval.
2. Implemented: configurable immutable asset URL and explicit mirror commands;
   generated mirrors are ignored. Preserve byte verification and offline/mirror
   coverage when advancing the asset revision.
3. Implemented: `open-brush-reference.json` pins the audited upstream commit,
   and asset extraction rejects a checkout at any other revision.
4. Open: gate extraction regeneration with a temporary-directory byte comparison
   in CI. Existing generated-asset/interface tests do not perform that round trip.
5. Partial: descriptor and texture-importer metadata are extracted. Still audit
   required vertex layouts, keywords, render state, and environment/audio inputs
   against their consumers; presence in JSON is not proof of implementation.
6. Partially implemented: deterministic fixtures now compare Open Brush live
   meshes with `three-tiltloader` output for all 95 required brushes. Still add
   post-BrushBaker meshes, UnityGLTF attributes, post-`three-icosa` shader
   attributes, and selected maintained-shader branches for the relevant export
   paths, including all 20 BrushBaker mappings.
7. Partially implemented: evidence states distinguish asset readiness, renderer
   eligibility, mesh contract, browser compile, XR compile, and persisted visual
   results. CI also checks active vertex/fragment varying links across all 95
   required authoritative shader pairs. The source live-mesh fixture gate is
   95/95; browser-image automation and a complete XR matrix remain open.
8. Partially implemented: the browser route now reproduces the existing Open
   Brush `UiScreenshotter` path, perspective framing, fixed shader time, and
   stroke seed without generator-specific control-point mutations. Deterministic
   Unity live-mesh dumping is implemented; automated image comparison remains open;
   do not replace the existing screenshot corpus with a new visual target.

Exit: CI explains exactly why every GUID passes or fails.

### Phase 1: ribbons (live-mesh fixtures implemented)

The typed-array ribbon generators and tests live in `three-tiltloader` and are
consumed by Open Brush web. The current source fixtures cover QuadStrip/Flat frames,
breaks, UV modes, physical-length UVs, atlas selection, backfaces, normals,
tangents, color, and pressure behavior. Required ribbon brushes pass the live-mesh
gate. Incremental adjacent-knot rebuild behavior and browser/image validation for
brush-specific deformation remain open.

### Phase 2: tubes (live-mesh fixtures implemented)

The shared tube generators now cover side count, caps, hard edges, source frame
attributes, distance/circumference UVs, radius packing, tangents, transitions,
and configured modifiers. Required tube brushes pass the live-mesh fixture gate.
Browser/image validation of deformation and culling, including Disco and
LightWire, remains open.

### Phase 3: materials and shader context (partially implemented)

1. Implemented: repin the three dependencies to the reviewed revisions and load
   all 111 configured materials without modifying maintained shader source.
2. Implemented upstream, package-tested, and exercised in Gallery Viewer against
   the exact pinned checkout: the optional `three-icosa` material factory
   preserves the existing default `RawShaderMaterial` and adds an explicit
   opt-in factory.
3. Define a typed vertex-layout registry shared by `three-tiltloader` geometry and the Open Brush web/`three-icosa` binding adapter.
4. Implemented in the maintained loader and fallback path: texture
   color/sampler metadata and transforms. Compression, platform overrides, and
   full importer semantics remain separate gaps.
5. Partial: blend/depth/culling defaults are mapped; complete render-state parity
   still needs per-brush reference validation. Do not add speculative alpha
   transparency sorting absent from the Open Brush contract.
6. Open: derive lights, fog, time origin, canvas transform, and other globals
   from the loaded sketch/environment rather than one Standard rig.
7. Implemented: shared pass/group helpers are consumed for Electricity and the
   Toon brushes. Validate their actual-stroke images against Unity. Classify
   additional passes absent from maintained assets as upstream limitations.
8. Implement real audio-analysis inputs or classify those variants as non-reactive.
9. Remove the obsolete extracted shader corpus and duplicated binding tables only after all required brushes resolve through the trusted dependencies.
10. Partial: per-GUID shader evidence and late material upgrades exist. Still
    combine them with mesh/image/device evidence and explicit revision provenance.
11. Validate bloom/tone mapping on desktop and Quest.

### Phase 4: particles (live-mesh fixtures implemented)

The particle generators and tests live in `three-tiltloader` and Open Brush web uses
the shared API. Deterministic RNG/salts, distance spawning, generator-specific
placement, source frame vectors, packed UVs, and birth data are represented in
the current live-mesh fixtures; package tests cover preview behavior and
finalization. Required particle brushes pass the fixture gate. Phase behavior
after collaboration and undo/redo, plus browser-image and XR validation, remains
open.

### Phase 5: required special generators (implemented)

The required hull, ConcaveHull, ThickGeometry, SquarePaper, and 3D Printing
Brush paths are implemented and pass the current live-mesh fixture criteria.
Hull fixtures compare polygonal faces instead of triangle indices because valid
convex-hull libraries can triangulate the same face differently. ConcaveHull uses
a deliberately weaker rule: every Open Brush surface vertex must be represented
within tolerance, while additional decomposition is permitted. Its pass does not
claim identical face decomposition or triangle indices. Rendering and incremental
hardening remain separate work.
Compatibility-only Blocks, Plait/Braid, holiday, SVG, PBR, and environment
cases are explicitly outside the 95-brush target and remain import-only until
their scope is reconsidered.

### Phase 6: batching and hardening (production integration implemented)

1. Implemented: shared finalized meshes, upstream brush/layer grouping,
   incremental/provisional stroke handling, selection extraction/reinsertion,
   visibility, erase/undo, and compaction. Batching is default-on with an explicit
   opt-out; production connection is no longer an outstanding task.
2. Recorded: matched gallery renders, reduced draw calls, real connected peers,
   delayed material arrival, transformed selection/history, IndexedDB reload,
   and repeated cleanup/retention observations. See the
   [validation ledger](docs/stroke-batching-validation.md) for each test's scope
   and the [render contract](docs/stroke-batch-render-contract.md).
3. Open: transition-frame images, broader brush/deformation/frustum coverage,
   adverse network timing, context loss/recovery, and load/event-latency and
   retained-capacity budgets. Alpha-blended families are not covered by an
   existing transparency-order gate; establish the upstream contract first.
4. Open: physical-headset interaction, GPU/frame budgets, and memory pressure.
   Desktop geometry/JS counters and emulated stereo do not establish these.

## Recommended sequence

Keep the 95-brush target: 48 standard plus 47 non-broken experimental brushes.
Geometry and production batching already have implementations and recorded
validation. Next establish reproducible current-revision evidence, then fix the
measured visual/behavior gaps. Use standard brushes for early iteration, while
keeping every result visible across all 95; do not postpone known experimental
regressions simply because the standard subset passes. Follow the immediate
backlog below rather than restarting completed migration or batching work.

## Application parity scope and estimation

Brush fidelity is one workstream. The following is an inventory for subsequent
feature audits, not a claim that every named Open Brush behavior is implemented
or missing. Code presence proves a starting point; native/web scenario comparisons
are still needed to decide feature parity.

| Surface | Current source to audit | Completion evidence to collect |
| --- | --- | --- |
| Painting and guides | [stroke-authoring-system.ts](src/systems/stroke-authoring-system.ts), [tools.ts](src/tools/tools.ts): free paint, straightedge, mirror, grid, lazy input, tape, and front-plane stencil modes are represented. | Match native controller sampling, pressure, tool transitions, guide placement, and undo under the same inputs; descriptors alone are insufficient. |
| Selection, erasing, picking, history | [selection-system.ts](src/systems/selection-system.ts), [input-command-system.ts](src/systems/input-command-system.ts), and batching ledger. | Extend the recorded desktop cases to actual controller interaction, brush-edge/overlap cases, transformed canvases, save/load, and native behavior comparisons. |
| Layers and groups | [layer-canvas-system.ts](src/systems/layer-canvas-system.ts), [layers.ts](src/sketch/layers.ts), document/stroke metadata. | Audit available UI operations, group transforms, visibility, history, persistence, and Open Brush round trips; layer-aware rendering is not a complete layer workflow. |
| Media | [media-assets.ts](src/sketch/media-assets.ts), [document.ts](src/sketch/document.ts). | Inventory actual import/placement/playback UI and supported formats; stored references do not prove media-tool parity. |
| Camera and capture | [camera-tool-system.ts](src/systems/camera-tool-system.ts). | Compare snapshot framing and export; separately scope video, paths, and other native camera modes instead of inferring them from the snapshot tool. |
| Environments and shader context | [standard-environment-system.ts](src/systems/standard-environment-system.ts), [brush-shader-library.ts](src/brushes/brush-shader-library.ts). | Reproduce environment selection/persistence, lights, fog, time/scale, audio analysis, and post-processing in matched captures. |
| Files and gallery | [tilt-file.ts](src/sketch/tilt-file.ts), [sketch-memory.ts](src/sketch/sketch-memory.ts), [glb-export.ts](src/sketch/glb-export.ts), [sketch-library-system.ts](src/systems/sketch-library-system.ts). | Native-to-web and web-to-native fixtures covering units, layers/groups, metadata/media and unsupported data; export-path visual evidence is separate from live meshes. |
| Collaboration | [collab-system.ts](src/systems/collab-system.ts) and connected-peer ledger entries. | Prove visual/timing/history equivalence after reconnect, delayed packets/materials, replacements and undo; successful transfer alone is insufficient. |
| Other native features | Scripting/plugins, platform integrations, remaining panels/settings and native tool modes need a dedicated inventory. | Compare each desired workflow against a pinned native reference and explicitly record web constraints or a user-approved exclusion. No blanket exclusion is established by this report. |

The old percentage and calendar estimates are not a current delivery forecast.
Estimate individual work packages after fixture provenance, acceptance criteria,
dependency ownership, and device access are established. Brush coverage counts
must not be used as the denominator for overall application parity.

## Immediate backlog

The order below is the active plan. Each item separates implementation from the
evidence needed to close it. No new parity implementation is part of this document
update.

1. **Establish reference inputs and capture provenance.** Use the existing
   95-image corpus at
   `C:\Users\andyb\Documents\open-brush-fast\Support\Screenshots\brushes-postfx-disabled`.
   Record producing Unity revision, fixture/path/seed, environment, shader time,
   camera, color pipeline, antialiasing and capture size. Resolve the observed
   2048x2048 corpus versus 1024x1024 pinned/browser generator mismatch explicitly.
   Located and regenerated the native mesh/GLB fixture set at `Support/BrushFixtures`;
   its hashes, source revision and 95/95 comparison are now recorded in the
   [fresh-run evidence](docs/evidence/brush-fidelity/native-2026-10-21/README.md).
   Existing PNG hashes/dimensions are recorded separately with provenance open. Exit:
   immutable input manifest and reproducible commands; no newly invented baseline.
2. **Publish current per-GUID evidence.** Join required inventory with mesh,
   asset-load, browser compile, actual-XR compile, Unity-image differences, and
   performance/device observations, keyed by app/package/asset/Unity revisions.
   Keep missing, failed, and passed evidence distinct. Replace or qualify
   eligibility-derived confidence labels. Exit: every one of the 95 GUIDs has
   attributable evidence or an explicit unverified state; connectivity and
   nonempty-render checks cannot count as conformance passes.
3. **Automate the existing visual comparison path.** Reuse the current
   `?visual-conformance=brush&brush-guid=...` route, fixture generator, and image
   metrics. Match the established corpus settings, preserve raw actual/reference
   images, and publish silhouette/RGB errors per GUID before setting calibrated
   acceptance thresholds. Start diagnosis with ordinary ribbons plus Disco,
   LightWire, Oil Paint, Electricity, Toon, and Tube Toon Inverted; run all 95 for
   the report. Exit: reproducible captures and ranked differences, with agreed
   tolerances rather than an unsupported aggregate parity score.
4. **Reproduce mesh evidence and cover export contracts.** Current package pins
   now match all 95 required fresh native dumps; the newer native catalog's five
   extras are explicitly excluded from that target. Keep
   family-specific comparison rules explicit, especially hull/ConcaveHull.
   Native post-BrushBaker meshes and actual exported GLBs are already generated;
   add comparison of those stages and post-`three-icosa` attributes, including the
   20 recorded BrushBaker mappings. Exit: distinct
   live-mesh and export-path reports; an export pass cannot replace a live pass.
5. **Harden vertex contracts and incremental authoring.** Define the shared
   typed vertex-layout contract and fail explicitly for missing required
   attributes. Check adjacent-knot rebuilds, restarts, preview/finalization,
   pressure/twist and break handling against the native reference. Make reusable
   generator changes upstream in a separately located checkout; do not patch
   installed packages. Exit: deterministic semantic fixtures plus native/browser
   images for the affected brushes, without app-specific shader workarounds.
6. **Close shader-context and animation gaps.** Validate Disco/LightWire
   deformation and particle birth/phase through load, undo/redo and collaboration.
   Scope loaded-environment inputs, audio analysis, render states, and
   bloom/tone mapping against native captures. Exit: matched time/scene/operation
   fixtures; drawing sounds are not evidence of audio-reactive shader inputs.
7. **Finish production-batching validation.** Extend the existing default-on
   renderer rather than adding a second integration. Cover transition frames,
   animated/frustum-edge brushes, adverse network/material timing,
   context loss/recovery, and explicit latency/retained-capacity budgets. Carry
   forward the recorded connected-peer, selected-stroke, delayed-material,
   gallery and ten-cycle cleanup observations at their stated scope. Exit:
   matched visual/interaction results and resource budgets for realistic sketches.
8. **Validate on physical Quest.** Exercise guarded normal mapping, the
   per-GUID shader matrix, actual controller interactions, stereo/multiview,
   representative heavy sketches and memory pressure. Persist device/browser,
   revisions, captures, frame/GPU evidence and failures. Exit: hardware results;
   desktop Chrome, an active session, and emulated stereo are separate evidence.
9. **Consolidate parsing without losing app metadata.** Audit the shared
   package API against local `.tilt` archive/stroke readers and writers, including
   units, layers, media, thumbnails and extensions. Current geometry delegation
   does not establish parser migration. Exit: native/web round trips and existing
   persistence/history behavior pass before redundant parsing is removed.
10. **Turn the application inventory into feature plans.** Compare the workflows
    in the scope table with native Open Brush, record implementation and evidence
    gaps, and prioritize the next feature slice with the user. Exit: explicit
    behavior and acceptance scenarios per feature, without treating brush fidelity
    as proof of full application parity or making unapproved exclusions.

## Primary references

- [Open Brush brush sources](https://github.com/icosa-foundation/open-brush/tree/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Scripts/Brushes)
- [`BaseBrushScript.cs`](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Scripts/Brushes/BaseBrushScript.cs)
- [`QuadStripBrush.cs`](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Scripts/Brushes/QuadStripBrush.cs)
- [`TubeBrush.cs`](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Scripts/Brushes/TubeBrush.cs)
- [`GeniusParticlesBrush.cs`](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Scripts/Brushes/GeniusParticlesBrush.cs)
- [`Export.cs`](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Scripts/Export/Export.cs)
- [`OpenBrushExportPlugin.cs`](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Scripts/UnityGLTF%20Plugins/OpenBrushExportPlugin.cs)
- [`BrushBaker.cs`](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Scripts/Export/BrushBaker.cs)
- [`BrushBaker.prefab`](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Prefabs/BrushBaker.prefab)
- [Export shader sources](https://github.com/icosa-foundation/open-brush/tree/4786d55ad398bfc957d8e8eb26438920026aeaf6/Support/GlTFShaders)
- [Export manifest](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Support/exportManifest.json)
- [Brush screenshot generator](https://github.com/icosa-foundation/open-brush/blob/4786d55ad398bfc957d8e8eb26438920026aeaf6/Assets/Editor/UiScreenshotter.cs)
- Existing Unity image corpus: `C:\Users\andyb\Documents\open-brush-fast\Support\Screenshots\brushes-postfx-disabled` (95 images, 2048x2048; capture provenance still to establish)
- [IWSDK](https://iwsdk.dev/) live scene/ECS inspection and browser/XR runtime tools
- [`icosa-sketch-assets`](https://github.com/icosa-foundation/icosa-sketch-assets) maintained web shader and texture assets
- [`three-icosa`](https://github.com/icosa-foundation/three-icosa) Three.js Open Brush material extension and bindings
- [`GOOGLE_tilt_brush_material.js`](https://github.com/icosa-foundation/three-icosa/blob/main/src/loader/GOOGLE_tilt_brush_material.js) active exported-geometry attribute remapping and exporter detection
- [`three-tiltloader`](https://github.com/icosa-foundation/three-tiltloader) intended shared `.tilt` parsing and brush-geometry package

## Verification note

The initial report was a source and asset audit. Subsequent implementation commits
are gated by TypeScript checking, the full Vitest suite, a production Vite build,
live Chrome rendering when the browser connection is available, and the GitHub
Pages workflow. Those checks catch compilation and gross rendering failures but
do not constitute Unity image or mesh conformance. Physical Quest verification
is still required for shader changes; guarded normal mapping is enabled by default
after desktop A/B and real-stroke gates, but the prior headset black-output failure
means on-device evidence remains mandatory.
