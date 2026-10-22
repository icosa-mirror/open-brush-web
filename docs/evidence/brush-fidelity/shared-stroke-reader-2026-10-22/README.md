# Shared persisted-stroke reader: 2026-10-22

1. `readSketchMemory` now delegates to the pinned public
   `three-tiltloader.readTiltStrokeData` API. This removes 133 lines of duplicate
   app parsing/extension traversal. The app retains its binary writer and
   archive/document wrapper because the installed package exposes no matching
   writer or app layer/media metadata contract. No dependency pin or installed
   package is modified.
2. Before replacing the reader, a comparison of its output with the installed
   shared reader on the existing `brush_cafe_experimental.tilt` sample found
   equal values for all 557 strokes, 40,641 control points and 91 brush GUIDs.
   Equality checks compare field values independently of object property order.
   [baseline-comparison.json](baseline-comparison.json) records the sample and
   previous app-reader hashes. The sample's producing native revision/settings
   are unknown; neither its bytes nor individual stroke geometry are published.
3. [results.json](results.json) records the current app reading that same sample,
   writing a new archive, and reading it again. All app-known stroke values
   survive, including deterministic document-local IDs, brush IDs/size/scale,
   color, flags, signed seeds, groups/layers and point pose/pressure/time.
   Existing app layer/media values also survive this operation. This is a file
   contract check; it does not invoke native Open Brush or establish rendering,
   unit conversion, handedness or native import equivalence.
4. The audit also exposes a **failed archive-preservation boundary** in the
   existing wrapper. Fifteen native metadata keys are dropped on rewrite,
   including `Layers`, `Environment`, `Lights`, `CameraPaths`, `Mirror`,
   `SceneTransformInRoomSpace`, `Palette` and application/schema provenance.
   The thumbnail is replaced by the writer's default image unless an explicit
   option supplies it. Those losses predate this reader consolidation and
   remain unresolved. Native metadata is not interpreted merely because the
   app's reduced document round-trips. Unknown binary extensions are skipped
   by both readers rather than retained for later export.
5. Full checks passed: 85 Vitest files, 594 passing tests and four existing
   TODOs; the mirror production build passed. Existing regressions exercise
   deterministic IDs, scalar/point fields, unknown word/blob/point extension
   alignment and out-of-range brush indices. The shared reader additionally
   rejects point counts exceeding available bytes before allocating point
   objects. No live native Editor import, editing/history interaction or
   physical-device validation was performed for this change.

Reproduce the current file audit from the repository root with a new directory:

```powershell
node scripts/audit-tilt-roundtrip.mjs --sample brush_cafe_experimental.tilt --output .tmp/native-tilt-roundtrip
```

The runner binds sample and producing-code hashes, rejects changed app-known
values, records dropped/changed metadata and entries, and preserves the input
file. A successful audit command means the observations were collected; it is
not an all-fields archive-preservation pass. The next migration step is to
preserve native metadata/thumbnail bytes through document persistence and
editing, then test native/web round trips before removing the archive wrapper.
