# Active emulated-XR shader audit: 2026-10-22

1. [results.json](results.json) records all **95 required brushes**, with **99
   fresh programs/material passes** linked in an active IWER immersive-VR
   session. Every material pass was observed for both view cameras: **198
   view/pass observations**. Vertex compile, fragment compile and link statuses
   succeed. The session ended normally. There are zero console errors, page
   errors and graphics warnings. [manifest.json](manifest.json) records these
   counts and report/log hashes.
2. This is a dedicated IWSDK world using the application's shader library,
   material adapter, render-pass helpers and generated geometry. The desktop
   and XR diagnostics now share the binding helper which preserves packed UV0
   and supplemental channels. Each input comes from the previously generated
   native fixture corpus, with its hash checked against that run's manifest.
   Unity units are scaled by 0.1 and Z handedness reflected; non-identity canvas
   transforms are rejected. Geometry is centred in front of the emulated head,
   and frustum culling is disabled. No image-parity claim follows from this pose.
3. Each row requires the emulator, IWSDK world and renderer to share the active
   session; viewer poses must report left/right eyes. Actual renderer cameras
   have distinct positions, approximately `[-0.0315, 1.6, 0]` and
   `[0.0315, 1.6, 0]`. The configured IPD is 63 mm and stereo is explicitly
   enabled. This is not a two-camera scene substituted for a WebXR session.
   The runtime reports IWER **2.2.1** with a Meta Quest 3 device profile, running
   on desktop Chrome/ANGLE SwiftShader. That profile is not Quest hardware.
4. The application-style optional hand-tracking/layers features are requested.
   Hand tracking is granted; controllers and hands are disconnected for this
   isolated brush test, so hand/controller interaction is not exercised. The
   public IWER layers polyfill supplies the projection-layer API. For every row,
   the renderer's projection layer is present in the session's render-state
   layer list. The underlying enabled-features list does **not** contain a native
   `layers` grant. Polyfilled projection-layer rendering is recorded explicitly;
   native hardware layers support remains unverified.
5. Earlier samples exposed nominal two-view sessions with zero IPD, and an
   earlier full run emitted deleted-program WebGL warnings during test-material
   cleanup. Those runs are rejected as clean evidence. The final harness uses
   public stereo/IPD settings and resets the owned renderer's GL state before
   disposing its temporary materials. Graphics warnings now fail the runner,
   independently of successful links. No installed package was edited. Earlier
   startup failures without complete results likewise add no passing evidence.
6. [results.json](results.json) binds producing source, the injected runtime
   bundle, inventory, lockfile, native generation and per-input hashes. Its app
   revision `949236f` is the baseline before this change. Raw browser/server
   logs remain in `.tmp/xr-brush-shaders-clean`; the source hashes identify this
   change's actual producing code. The native source is `5591ff1...`, distinct
   from the report's declared `4786d55...` reference; joining the result does not
   reconcile those revisions or the existing native PNG capture settings.
7. Full checking passed: 85 Vitest files, 594 passed tests and four existing
   TODOs. The mirror production build passed. Regressions reject inactive or
   mismatched sessions, repeated/missing eye identities, identical/nonfinite
   eye positions, absent projection layers, desktop records labelled XR,
   incomplete per-eye material passes, UV-layout drift and graphics warnings.

This establishes shader compile/link in the recorded active emulated session.
Physical-device XR compilation remains unverified, as do physical input,
application/gallery/history lifecycle in XR, all runtime variants, visual
parity and frame/memory budgets. Fresh program creation and diagnostic GL queries
make these runs unsuitable for performance measurement. No physical headset or
other application scene is controlled by the harness.

From the repository root, run type checking and `npx iwsdk xr status` first.
Reuse an existing Vite URL with `--url`; otherwise the runner owns a temporary
Vite server on port 4194 and a private automation browser:

```powershell
npm run test:xr:brush-shaders -- --fixtures 'C:\Users\andyb\Documents\open-brush-fast\Support\BrushFixtures' --output .tmp/new-xr-brush-shaders
```

The output directory must be new. `--brush <name-or-GUID>` can select a smaller
explicit subset; a subset is not a 95-brush pass. The runner stops after a brush
failure, records unattempted entries, ends the session and closes only its own
browser/server. It rejects fixture bytes differing from the recorded native
generation instead of silently attaching a revision to other inputs.
