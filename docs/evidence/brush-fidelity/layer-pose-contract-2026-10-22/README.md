# Layer pose document/file contract: 2026-10-22

1. `SketchLayer` now has an optional independent position/rotation/uniform-scale
   pose. Native metadata becomes a web-basis pose without changing stroke-local
   control points or brush sizes. Web layer metadata can carry that pose, and
   the gallery's document snapshot preserves it when collecting layer state.
   Document construction and persistence snapshots copy pose arrays.
2. [results.json](results.json) repeats the existing café file audit: 557
   strokes, 40,641 points and 91 used brush GUIDs. Original decoded native
   stroke values, original metadata values and retained archive bytes remain
   equal. Its layer transform is identity; this result does not validate
   transformed rendering or nonidentity native poses.
3. Five deterministic pose scenarios cover native translation/quaternion basis
   conversion, inverse serialization, scale normalization grounded in native
   source, invalid tuples/zero rotations, unchanged native encoding, explicit
   pose edits and copied document state. The file test keeps generator inputs
   layer-local while changing layer pose metadata. Existing persistence coverage
   now includes a posed layer through import/edit/save-as/reload/export and
   checks mutation isolation. The normalized pose does not replace the original
   native encoding unless the pose was actually edited.
4. Native `SaveLoadScript` treats a legacy zero scale as one;
   `CanvasScript.LocalPose` takes absolute scale and clamps it to `1e-4..1e4`.
   Rotations are represented as unit quaternions. Malformed interpreted pose
   data fails at the file boundary. The native serializer's nested TRS array and
   web extension's named pose object remain separate conventions.
5. Full checks passed with 88 files, **610 passing tests**, four existing TODOs;
   the mirror production build passed. The strengthened posed persistence case
   additionally passed its focused suite after type checking. A metadata scan
   of 49 bundled native `.tilt` samples found that none included layer metadata;
   [the inventory](native-sample-inventory.json) records paths and metadata hashes.
   A suitable real native sample has been requested; the nonidentity cases
   recorded here are deterministic fixtures, not live Unity captures.

This change establishes the document/file contract. **Layer poses are not yet
applied to rendered meshes or tool input.** Baking poses into control points
would change generator behavior, so rendering must retain the layer hierarchy.
The [integration plan](../../../native-layer-transform-integration.md) identifies
the remaining rendering, batching, preview, tool, selection, export and
collaboration gates. Live native import, image parity, hardware XR and room/
canvas/media transforms remain unverified. The source/sample hashes in the
report identify producing inputs; the app baseline was `650b6b3` before edits.
