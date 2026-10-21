# Isolated native export accessor comparison: 2026-10-21

1. [results.json](results.json) compares each required brush's post-BrushBaker
   mesh against the actual binary GLB accessors generated in the
   [fresh native run](../native-2026-10-21/README.md). All 95 required GUIDs match
   the audited exporter conversions at absolute tolerance `1e-5`; indices match
   exactly. All 20 recorded BrushBaker mappings are included. Five extra native
   brushes are explicitly excluded. Input hashes match the generation manifest.
2. The checker covers X reflection for position/normal/tangent, tangent W
   reflection, triangle winding reversal, UV0/UV1 XY truncation and V inversion,
   UV2 preservation, and Gamma-to-linear RGB conversion with unchanged alpha.
   Gamma is explicit CLI input, consistent with current project configuration
   (`m_ActiveColorSpace: 0`); generation did not record runtime activeColorSpace.
   Source files inspected for these rules are hashed in
   [source-manifest.json](source-manifest.json). This comparison checks the
   exporter transformations, not whether BrushBaker's transformations reproduce
   live rendering semantics.
3. Forty-four required brushes have UV components beyond XY discarded by the
   exporter. Each discarded component has its min/max/nonzero count recorded.
   This is an observed layout change, not automatically a semantic failure:
   a baker may repack a value into another channel. Shader consumption and
   repacking equivalence still require brush-specific checks.
4. All 95 GLBs use the `Open Brush UnityGLTF Mesh Fixture` generator marker.
   Isolated generation deliberately skips normal `BeforeSceneExport` setup.
   The installed `three-icosa` detects `Open Brush UnityGLTF Exporter` instead,
   so these fixtures do not exercise its new-exporter branch. Production scene
   export, post-loader attributes, shader behavior and visual parity remain
   unverified. No loader flag or fixture marker was changed to manufacture
   coverage. Existing live-mesh evidence remains separate.
5. TypeScript checking passed. Five focused tests passed, covering independent
   expected values, corrupted accessors, wrong color model, bounds/strides,
   nonfinite values and invalid native indices. The reader intentionally accepts
   only the audited single-mesh, uncompressed fixture format and rejects
   unsupported sparse/normalized accessors and unchecked attributes.

Run from the repository root:

```powershell
npm run compare:unity-exports -- --fixtures 'C:\Users\andyb\Documents\open-brush-fast\Support\BrushFixtures' --output .tmp/unity-export-accessors.json --color-space Gamma --manifest docs/evidence/brush-fidelity/native-2026-10-21/manifest.json
```

The report includes per-input, runner, contract, inventory, selection and lockfile
hashes. Its application revision is the pre-change baseline `60e8382`; the runner
and contract hashes identify the producing code in this change.
