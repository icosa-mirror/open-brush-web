# Native archive retention: 2026-10-22

1. The [previous sample audit](../shared-stroke-reader-2026-10-22/README.md)
   exposed 15 dropped native metadata fields and default thumbnail replacement.
   The document now carries opaque native metadata and non-stroke archive
   entries separately from supported web features. The writer merges current
   app fields with that retained data, regenerates `data.sketch`, and preserves
   original brush-index slots while appending newly used GUIDs. Explicit new
   thumbnail/hires options replace the corresponding retained preview only.
2. [results.json](results.json) repeats the same file-format audit on the same
   hashed café sample: **557 strokes, 40,641 points and 91 used brush GUIDs**.
   All app-known stroke values survive. No original metadata keys are dropped
   or changed, including the original `BrushIndex`, and non-generated archive
   entries retain their bytes. The original thumbnail is now preserved.
   The input sample and individual stroke geometry remain uncommitted.
3. Retained JSON and byte arrays are copied on document construction, unit
   conversion and persistence snapshots. Gallery open/save carries the document
   context rather than reconstructing it from strokes/layers alone. Starting a
   new sketch or joining another collaboration session clears that context so
   another sketch cannot inherit its native metadata/assets. An explicit newly
   captured gallery thumbnail still intentionally replaces the old preview.
4. Four regression scenarios cover unknown nested metadata and binary assets,
   unused brush-index slots plus a newly painted brush, preview replacement and
   catalog consistency, mutation isolation across conversion, and import/edit/
   save-as/reload/export through the persistence controller. The controller
   scenario verifies edited stroke values and retained native data together.
   Focused tests pass (16 tests); full checks pass (86 files, **598 passing
   tests**, four existing TODOs), and the mirror production build passes.
5. This closes the observed preservation loss at the tested file/document/
   controller boundary. It does **not** implement native environments, lights,
   camera paths, text/video/guide widgets or native layer behavior in the web
   runtime. Opaque native transforms are retained without interpreting or
   reconciling them with converted stroke coordinates. Unknown binary stroke
   extensions and file-header extensions are still not retained. Compression
   support is unchanged. Live native import, browser gallery/history interaction,
   collaboration metadata transfer and full native/web semantic round trips
   remain unverified. The gallery context wiring was source-reviewed and
   type-checked; the controller tests are not browser interaction evidence.

Reproduce the file audit from the repository root with a new directory:

```powershell
node scripts/audit-tilt-roundtrip.mjs --sample brush_cafe_experimental.tilt --output .tmp/native-archive-retention
```

The report binds sample and producing-code hashes. Its app-level/source scope
remains narrower than native Editor import and visual/interactive conformance.
The sample's producing native revision and settings remain unknown. Earlier
failure evidence is retained at its original path rather than overwritten.
