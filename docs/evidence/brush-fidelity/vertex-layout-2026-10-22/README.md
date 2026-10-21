# Generated vertex layout boundaries: 2026-10-22

1. The app's `BrushVertexLayout` now derives UV widths from the installed
   generator's `BrushGeometryArrays` type. Live rebinding and batch copies use
   the same shader-UV0 array selector. Required Float32 channel capacities,
   Uint32 index capacity, supported widths and used vertex/triangle counts are
   checked explicitly. Batch append additionally rejects a layout differing
   from its destination before copying data or adding a subset.
2. Live drawing checks these capacities when buffers are rebound, alongside
   the allocations already needed for that operation. Rebinding now includes
   changes to UV1 width as well as UV0. It checks the standard UV1 attribute,
   so Leaky Pen's supplemental shader alias does not force a rebind every
   sampled frame. No per-vertex scan, per-frame validation cache or generator
   change was added. Batch append checks once before its existing buffer copy.
3. [results.json](results.json) records 95/95 required brushes satisfying this
   shape/capacity contract across **3,705 generated states**. For each existing
   fresh native input, the runner grows its control-point prefix with keeper
   points and then finalizes, reusing one output allocation. All input hashes
   match the [native generation manifest](../native-2026-10-21/manifest.json).
   The report includes runner, contract, inventory and lockfile hashes; its
   application revision `789658e` is the baseline before this change.
4. Full repository checking passed: 82 Vitest files, 579 tests and four existing
   TODOs. Four focused tests cover all nine supported UV-width combinations,
   spare capacity, required missing/short channels, invalid counts/index
   capacity, and batch rejection without partial mutation. The production
   mirror build passed. These are structural and build checks, not headset
   interaction or live browser-authoring observations.

This does not inspect numeric vertex values, index ranges, semantic packing,
shader-active attributes, preview/provisional sampling, undo/restart behavior,
or native incremental-mesh equivalence. Those remain required follow-up work;
the full vertex/shader contract is not complete. No installed package was edited.

```powershell
npm run check:brush-vertex-layouts -- --fixtures 'C:\Users\andyb\Documents\open-brush-fast\Support\BrushFixtures' --output .tmp/vertex-layout-capacities.json
```
