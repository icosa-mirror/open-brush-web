# Native reference source comparison: 2026-10-22

1. [results.json](results.json) compares committed Git blobs at the declared
   reference `4786d55ad398bfc957d8e8eb26438920026aeaf6` and the fixture-producing
   revision `5591ff1aad5288903e718752c522d54420ae6d1e`. Both objects are available
   in the native checkout. The audit is read-only: it neither switches that
   checkout nor changes the app's reference configuration. It records input
   manifest/inventory hashes, its runner hash, and before/after Git blob IDs.
2. The selected source/resource scope contains **1,166 changed paths**. Brush
   C# sources comprise 19 modified, five deleted and four added files. Existing
   modified sources include shared `BaseBrushScript`, `GeometryBrush`,
   `FlatGeometryBrush`, `QuadStripBrush`, `SprayBrush` and `TubeBrush`. This
   comparison includes ordinary and experimental resource directories. It is
   not a complete dependency closure: other project/package/settings changes
   can also affect runtime output.
3. All **95 required GUIDs** resolve to exactly one serialized brush descriptor
   at both revisions. All 95 descriptors have changed bytes/fields. The new
   `m_TestingMaterial` and `m_OverlayMaterial` fields appear on all 95; those
   additions alone do not establish a changed rendered result. Material
   references differ for 48 descriptors, descriptions for 28, and prefab
   references for 13. These counts overlap. The per-GUID rows record paths,
   blob IDs and changed top-level serialized fields, including nested field
   contents. They are textual observations, not semantic equivalence verdicts.
4. Prefab references differ for Embers, Smoke, Snow, Stars, Bubbles, Dots,
   Petal, Spikes, Comet, Rain, Sparks, Rising Bubbles and TaperedWire. A prefab
   reference affects which implementation/configuration is instantiated; it
   cannot be dismissed as descriptor presentation metadata. The audit does not
   follow those references or attribute every shared-source change per brush.
5. A direct source review also finds a concrete runtime difference in
   `Assets/Scripts/Brushes/BubbleWandBrush.cs`: the constructor changes from
   `base(false)` to `base(true)`, finalization preparation is shared by solitary
   and batched paths, and the older update of UV0.Z with `Time.time` is removed.
   The newer source explains that its shader interprets that component as
   radius. This records the source change; it does not prove either revision's
   visual equivalence or retrospectively identify the original PNG producer.
6. Therefore the fresh 95/95 mesh comparisons remain evidence against
   **`5591ff1`** under their recorded fixture rules. They cannot be relabelled
   as measurements against `4786d55`. All 95 rows explicitly retain runtime
   equivalence as unverified. Selecting a new normative reference or generating
   a matched baseline at the declared revision is still required. No automatic
   pin update or visual-parity promotion follows from this audit.

Reproduce from the web repository root, with a new output directory:

```powershell
node scripts/audit-native-reference.mjs --repository 'C:\Users\andyb\Documents\open-brush-fast' --output .tmp/native-reference-source-audit
```

The runner reads Git objects rather than current working files, so existing
Editor changes and unsaved scenes do not affect this comparison. It requires
both recorded commits to be present locally and rejects duplicate/missing
required descriptor GUIDs. It does not launch or refresh Unity. The source
comparison and per-GUID field counts were checked against their recorded Git
trees; application/runtime tests were not rerun for this static evidence update.
