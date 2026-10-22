# Native layer names and visibility: 2026-10-22

1. Native `Layers` metadata now supplies document layer names and visibility
   when the app extension has no layer definitions. Native IDs are array
   positions, matching the declared reference's `LayerMetadata` definition,
   `SceneScript.LayerCanvasesSerialized()` and `SaveLoadScript` load loop. Native
   metadata has no lock field; web lock state remains in the app extension.
   Missing metadata still falls back to stroke layer IDs and default names.
2. Exports now write current layer names/visibility into native `Layers`, retain
   existing transforms/unknown fields and original native slots, and append
   new layer slots with identity transforms. Sparse web IDs map to compact
   native indices through `OpenBrushIwSdk.nativeLayerIds`. The reader restores
   web IDs through that map; ambiguous/invalid maps fail. A large sparse web
   ID therefore does not allocate a correspondingly large native layer array.
3. `LayerCanvasSystem.setLayers` restores actual component state, removes stale
   paint-layer entities, retains tool selection canvases and chooses a visible,
   unlocked active layer when available. The gallery's shared document-context
   path applies layers before spawning a loaded sketch and resets them on new,
   welcome and collaboration-join transitions. Layer definitions are dynamic
   file data, so new layer entities use the existing runtime ECS API.
4. [browser-results.json](browser-results.json) records an isolated IWSDK world
   in desktop Chrome/SwiftShader. Three paint layers restore with names,
   visibility and locks; layer 1 becomes active. A hidden-layer stroke remains
   logically visible but has `renderVisible = false` and its mesh is hidden;
   the shown-layer stroke remains rendered. Reset leaves one fresh paint layer,
   removes stale layers and preserves the selection canvas. Console/page errors
   and graphics warnings are zero. This observes actual component queries and
   mesh visibility; it is not a screenshot or UI-interaction comparison.
5. An initial isolated run omitted registration of `BatchedBrushStroke`, whose
   schema the application normally registers through its batch renderer. That
   run stopped during `hasComponent` and is rejected. The corrected harness
   explicitly registers the schema and passes; it does not pretend to exercise
   batching. Failed raw runs remain separate under `.tmp/native-layer-runtime*`.
6. [file-results.json](file-results.json) repeats the hashed café sample audit:
   557 strokes, 40,641 points, 91 used brush GUIDs. All decoded original native
   stroke values, original metadata values and retained archive bytes still
   match after rewriting. Three added file tests independently construct native
   layer metadata, check rename/visibility edits with transform preservation,
   verify compact slots for sparse IDs, and reject ambiguous maps. Full checks
   passed: 87 files, **605 passing tests**, four existing TODOs; the mirror build
   passed. The corrected browser harness also passed type checking before use.

Native layer transforms are **retained, not applied** to web stroke geometry.
Room/canvas transforms, layer manipulation UI, native widget/media layers,
batched-stroke visibility on this load path, browser gallery transitions,
connected collaboration and live native import remain open. The isolated world
does not control a physical headset or an existing application scene. Source
hashes identify producing code; the producing app baseline is `3a0b5b6` before
these edits. The native sample's producing revision/settings remain unknown.

From the repository root, type-check and check `npx iwsdk xr status` first.
The browser runner can reuse an existing Vite URL with `--url`; otherwise it
owns a temporary server on port 4196 and a private automation browser:

```powershell
node scripts/browser-layer-state.mjs --output .tmp/new-layer-runtime
node scripts/audit-tilt-roundtrip.mjs --sample brush_cafe_experimental.tilt --output .tmp/new-layer-file-audit
```

Both output directories must be new. Raw browser/server logs for the accepted
run remain in `.tmp/native-layer-runtime-clean`. No parity score follows from
these state and file-format checks.
