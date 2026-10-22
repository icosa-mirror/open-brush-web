# Particle replay birth times: 2026-10-22

1. Native `PointerScript.UpdateLineFromControlPoint` and `UpdateLineFromStroke`
   replay position, orientation and pressure without passing saved timestamps.
   `GeometryBrush` stamps new knots with `CurrentSketchTime`.
   `GeniusParticlesBrush` and `MidpointPlusLifetimeSprayBrush` convert that time
   through `App.SketchTimeToLevelLoadTime` into packed birth channels. The web
   import path previously requested deterministic zero births, making particle
   age depend on the application's time since startup rather than replay.
2. Imported web strokes retain deterministic shared generation, then install
   their captured local replay origin into the appropriate birth channel before
   shader attributes or shared batch copies are bound. Original control-point
   timestamps remain in the document. Live local/remote authoring keeps its
   existing timestamp/offset path. Mirrored imported runtimes retain their
   source origin. No package, shader source or serialized format changed.
3. [browser-results.json](browser-results.json) checks actual production
   authoring, layer and batch systems in an isolated desktop browser. All ten
   timed particle brushes pass: Embers, Smoke, Snow, Stars, Bubbles, HyperGrid,
   Dots, Rising Bubbles, WaveformParticles and DanceFloor. Across 4,280 vertices,
   shader-bound births match the captured runtime origin. Visibility toggles
   preserve births, later imports receive a fresh origin, and intentionally
   future-dated saved timestamps remain unchanged. The observer reads actual
   batch subsets when private geometry has been retired, with a private-mesh
   fallback. Page errors, console errors and graphics warnings are zero.
4. A generator regression covers all ten brushes, retaining other packed
   channels, unused capacity and source data. Full checks passed: 91 files,
   618 tests and four TODOs. The mirror build passed; final harness typechecking
   also passed. The first browser run is rejected because its observer assumed
   private geometry remained available after batching. Only the final run in
   `.tmp/particle-replay-browser-final` supplies accepted evidence.
5. [manifest.json](manifest.json) binds the browser report, producing sources,
   checks and native source files at the declared reference revision. The app
   baseline before these edits was `f8cca75`. The stamping loop runs during
   imported geometry generation/rebuild, writes only used birth slots and
   allocates no per-vertex objects. This is application clock context around
   the shared generator, not a replacement generator.

This source-grounded birth-channel correction is not native pixel or animation
parity. Native capture, progressive playback, connected-peer phase agreement,
actual undo/redo animation observations and physical XR remain open. The checks
do not establish live streaming playback timing or a GPU/frame budget.

After typechecking and checking `npx iwsdk xr status`, use a new output directory
(pass `--url` to reuse an existing Vite server):

```powershell
node scripts/browser-layer-state.mjs --harness scripts/particle-replay-harness.html --output .tmp/new-particle-replay-run
```
