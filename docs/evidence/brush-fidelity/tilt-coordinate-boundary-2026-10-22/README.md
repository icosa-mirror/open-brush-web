# Tilt coordinate boundary: 2026-10-22

1. The archive reader now returns strokes in web coordinates for both native
   and web-produced files. Native Unity positions/brush sizes are converted
   from decimetres to metres; Z is reflected and quaternion components become
   `[-x, -y, z, w]`. The archive writer applies the inverse transform. Dimensionless
   brush scale, color, flags, group/layer IDs, seeds, pressure and timestamps
   retain their values. Low-level shared stroke reading and the retained binary
   writer still operate directly on their input coordinates.
2. New files record `OpenBrushIwSdk.coordinateSpace: "unity-decimeters"`.
   Files without the web extension are treated as native. Earlier web files
   with that extension but no marker retain their historical web-metre
   interpretation; the next save writes marked native coordinates. Explicit
   `web-meters` markers are also recognized. Unknown markers fail rather than
   silently choosing a scale. This compatibility rule uses the app-owned
   metadata extension, independently of archive location or sketch name.
3. The curated gallery no longer applies its own extra scale after reading.
   Local catalog loads, remote downloads and file audit callers share the same
   reader boundary. Previously the gallery alone scaled native data while
   local records did not, and exports wrote runtime metre values directly.
   This change fixes those file-coordinate conventions; browser interaction
   and visual orientation still require runtime validation.
4. [results.json](results.json) repeats the café sample audit with **557 strokes,
   40,641 points and 91 used brush GUIDs**. The original native and newly written
   `data.sketch` payloads are independently decoded with the shared public
   parser. All known native stroke values are exactly equal, and web-memory
   stroke values also survive the read/write/read cycle. Original metadata
   values and retained archive bytes, including the thumbnail, are preserved.
   This is decoded-value agreement, not byte identity of headers or unsupported
   binary extensions. Source and sample hashes are recorded.
5. Four independent archive scenarios construct native/legacy input files
   without using the production archive writer or coordinate converters. They
   check expected scale/position/quaternion values, inspect exported raw native
   values through the shared parser, retain older web files through repeated
   saves, and reject unknown markers. Full checks pass: 87 files, **602 passing
   tests**, four existing TODOs. The mirror production build passes.
6. The native unit constants are grounded in the declared reference's
   `Assets/Scripts/App.cs` (`METERS_TO_UNITS = 10`, `UNITS_TO_METERS = .1`). The
   Z/quaternion reflection matches the native-input adapter used by the existing
   95-brush mesh/compile diagnostics. This does not reconcile the declared
   native revision with the newer fixture-producing revision.

Native room/canvas transforms, media transforms, layer interpretation, native
metadata features, unsupported binary/header extensions and live native Editor
import remain open. The saved marker describes stroke coordinates; opaque
native metadata is retained without claiming its scene semantics are applied
in the web runtime. Existing app media metadata retains its previous convention.
The sample's producing native revision/settings remain unknown. Unity currently
awaits recovery of its detected scene backup, so this change includes no live
native import evidence or calibrated native/browser image comparison.

Reproduce from the repository root with a new output directory:

```powershell
node scripts/audit-tilt-roundtrip.mjs --sample brush_cafe_experimental.tilt --output .tmp/tilt-coordinate-audit
```
