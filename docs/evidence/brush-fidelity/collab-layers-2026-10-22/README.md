# Connected web layer context: 2026-10-22

1. Protocol v3 transfers validated layer IDs, names, visibility, locks and TRS
   in ordered chunks before stroke data. The host establishes the frame; the
   guest replies after applying it. Initial guest authoring waits for context.
   Existing strokes require the same effective layer poses before adopting a
   reconnect snapshot. Stroke coordinates remain layer-local; tips remain in
   the scene frame. Older protocol versions are explicitly rejected.
2. [browser-results.json](browser-results.json) records two private desktop
   Chrome peers using actual application systems and PeerJS/WebRTC transport.
   A rotated, translated, scaled layer and a hidden/locked layer synchronize,
   including a 1,400-character layer name. Layer models and stroke values agree
   exactly. Mesh parents and hidden rendering are checked. A delayed initial
   transfer proves pressed input creates no stroke before context is ready.
3. Concurrent synthetic mouse strokes use distinct UUIDs even with both local
   authoring counters forced to the same value. Guest undo/redo propagates.
   Closing the guest data channel permits drawing in its retained context;
   reconnection merges that stroke and preserves matching layer definitions.
   First connections now start with a retry budget, so an early disconnection
   can recover. Starting a new host sketch ends sharing and retains guest work.
4. All four recorded stages completed with zero page errors, console errors or
   graphics warnings. The earlier `.tmp/collab-layer-peers` run is rejected: it
   exposed the missing initial retry budget and stopped before offline replay.
   Only `.tmp/collab-layer-peers-recovery` supplies accepted browser evidence.
   The retained manifest binds the report, ten producing source files and the
   check/build logs. Full checks passed: 89 files, 616 tests, four TODOs; the
   mirror production build passed.
5. Unit checks cover bounded wire chunks with Unicode/escaping, invalid or
   incomplete transfers, layer ID/pose validation and repeated Float32 pose
   exchange. Already-unit Float32 quaternions retain their values rather than
   shifting one ULP after repeated normalization.

This validates the web application's two-peer layer context, not stock Unity
multiplayer interoperability, native render agreement or physical XR input.
Native opaque archive data, media and environment settings are not transferred
by this protocol. Live layer-editing synchronization, native widget layers and
full application parity remain open. The producing baseline was `e874db2`;
per-file hashes identify the tested working-tree changes.

After type checking and checking `npx iwsdk xr status`, use a new output directory
(pass `--url` to reuse an existing Vite server):

```powershell
node scripts/browser-collab-layers.mjs --output .tmp/new-collab-layer-run
```
