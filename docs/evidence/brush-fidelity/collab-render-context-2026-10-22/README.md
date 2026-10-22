# Shared custom lights and fog: 2026-10-22

1. Protocol version 4 sends layers and supported native render metadata in one
   ordered, chunked snapshot before strokes. Guests apply the complete context
   atomically and echo it; the host rejects conflicting guest settings. Version
   3 peers are rejected explicitly. This is web PeerJS transport, not native
   Open Brush multiplayer interoperability.
2. Supported fields are native fog color/density, ambient color, HDR directional
   light colors/orientations and the preset identifier. Native byte/HDR values
   and rotations retain their file encoding. Unknown archive fields and assets
   are excluded. A preset identifier does not implement its environment rig.
3. [two-peer-results.json](two-peer-results.json) records eight successful stages
   using two private desktop browsers and the actual application transport.
   Custom zero fog, ambient bytes and HDR lights reach the guest shader context
   and survive its native-file save/reload. Reconnection retains that context.
   Existing tests also cover simultaneous UUID authoring, undo/redo, offline
   merge, blocked early input and document replacement ending sharing.
4. A join with incompatible existing layer poses rejects the snapshot and
   preserves local work. After explicitly starting a blank sketch, a default
   host context clears previous overrides. A forged valid guest context is
   rejected without changing host settings or discarding either peer's work.
   Private host archive markers/reflection metadata do not transfer. Browser
   page errors, console errors and graphics warnings are all zero.
5. [default-reset-results.json](default-reset-results.json) independently checks
   the production document context, shared-context application and rendering
   systems. Explicit empty shared metadata restores Standard fog/lights after
   custom overrides. Scene scaling/rotation, late materials, zero fog and new
   document reset also pass, with no browser errors or graphics warnings.
6. Full local checks pass: 95 files, 635 tests and four TODOs; the mirror build
   passes. Three new codec regressions cover native encoding, invalid metadata
   and host equality. [manifest.json](manifest.json) binds sources, artifacts
   and check logs to the producing baseline `2bbfbeb`. Local checks include the
   separately recorded uncommitted selection files; their SDK parent-reference
   defect remains open and this evidence does not accept that implementation.

These checks establish supported metadata transport and renderer inputs. Native
pixels/color-space calibration, physical XR, live lighting editing, full preset
geometry, skyboxes, gradients, reflections and archive asset transfer remain open.
Earlier failed harness runs were discarded; only the completed accepted run is
retained here. The browser driver uses synchronous readiness predicates because
this installed Playwright version does not poll asynchronous predicates.

After typechecking and checking `npx iwsdk xr status`, use fresh output paths:

```powershell
node scripts/browser-collab-layers.mjs --output .tmp/new-collab-context-run
node scripts/browser-layer-state.mjs --harness scripts/render-context-harness.html --output .tmp/new-context-reset-run
```
