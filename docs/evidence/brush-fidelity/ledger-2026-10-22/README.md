# Required brush evidence ledger: 2026-10-22

1. [brushes.md](brushes.md) provides a compact row for each of the 95 required
   GUIDs. [ledger.json](ledger.json) retains the per-stage states, source-report
   hashes/revisions, native input/GLB/image hashes and explicit unverified
   states. It joins existing recorded observations; it is not a new capture or
   an aggregate parity score.
2. Recorded coverage is 95 finalized live-mesh matches under family-specific
   criteria, 95 isolated exporter-transform matches, 45 maintained-shader and
   50 retained-PBR fixture paths, and normal-export material names mapping to
   90 required GUIDs. WaveformParticles, Drafting, DuctTapeGeometry, Digital and
   Race remain unverified on the normal-export path. Name-derived matches do
   not establish original per-stroke GUID provenance or the full plugin path.
3. All 95 corrected browser PNG captures are recorded with equal generated and
   bound UV0 widths (`UV0` in the table is generated/bound). Coverage is 94/95;
   ConcaveHull's legacy planar case remains a failed coverage smoke check.
   Both successful captures and failed coverage remain distinct from visual
   parity, which is unverified for every brush. The 95 structural buffer checks
   likewise do not become native incremental-mesh or visual-equivalence passes.
4. Every GUID now has a recorded desktop browser compile/link audit for the
   99 programs bound in the recorded capture context. Separate asset-load audits,
   actual XR compilation, physical Quest interaction, device performance budgets
   and animation parity remain unverified. Capture output alone
   does not establish these stronger claims. Source reports retain their own
   bounded observations; the ledger does not overwrite historical evidence.
5. Generation rejects duplicate/missing GUID rows, mismatched native mesh/GLB
   or reference-image hashes, dependency-lock/inventory drift and unfinished
   browser runs. The ledger lists current package pins and the configured
   default asset revision, with historical per-request asset-content attribution
   still unverified. Recorded source app revisions can be baselines preceding
   producing edits: follow each source artifact and its README/source hashes
   rather than treating the revision alone as the complete producing checkout.
6. The declared native reference remains `4786d55...`, while the fresh fixture
   generator ran at `5591ff1...`. The ledger retains that discrepancy explicitly;
   joining records does not reconcile the native revisions or image settings.
7. Full checking passed: 83 Vitest files, 583 passed tests and four existing
   TODOs. Join regressions cover all 95 recorded identities, retained PBR paths,
   missing normal-export observations, captured/coverage-fail distinctions,
   duplicate/malformed/missing GUIDs and cross-report hash drift. No runtime
   rendering code was changed for this ledger.

Source reports:

| Stage | Source |
| --- | --- |
| Native input generation | [manifest](../native-2026-10-21/manifest.json) |
| Finalized live mesh | [comparison](../native-2026-10-21/live-mesh-comparison.json) |
| Post-baker versus isolated GLB accessors | [comparison](../export-accessors-2026-10-21/results.json) |
| Post-loader attributes | [inspection](../post-loader-2026-10-21/results.json) |
| Corrected browser captures | [captures](../browser-images-packed-uv-2026-10-21/results.json) |
| Prefix/finalization buffer capacities | [checks](../vertex-layout-2026-10-22/results.json) |
| Existing native image corpus | [inventory](../native-2026-10-21/image-corpus-inventory.json) |
| Desktop shader compile/link | [audit](../browser-shader-compile-2026-10-22/results.json) |

Rebuild the index from the repository root:

```powershell
npm run evidence:brush-fidelity -- --output docs/evidence/brush-fidelity/ledger-2026-10-22
```

The generator replaces only `ledger.json` and `brushes.md`; this README is
maintained separately. The ledger's producing application baseline is `f086d11`;
runner/joiner hashes identify the generator in this change.
