# Fresh native mesh fixtures: 2026-10-21

1. Opened `C:\Users\andyb\Documents\open-brush-fast` in Unity 6000.6.0f1, loaded
   `Assets/Scenes/Main.unity`, entered Play mode and invoked
   `Open Brush/Screenshots/Generate Brush Mesh Fixtures` through the Editor's
   Pipeline connection. The native checkout was at
   `5591ff1aad5288903e718752c522d54420ae6d1e`. Source hashes, run time, artifact
   hashes and worktree observations are in [manifest.json](manifest.json).
2. The Editor wrote **100 fresh mesh JSON files and 100 fresh GLBs** to
   `C:\Users\andyb\Documents\open-brush-fast\Support\BrushFixtures`.
   All artifact modification times were newer than the recorded invocation.
   [generation.txt](generation.txt) contains the run's unique marker and all
   100 fixture-write messages. No exception or C# error matched in that run's
   log section. Generation's one-stroke-per-batch and deterministic-birth-time
   flags returned to false; Play mode was then stopped and the Editor left open.
3. The current web inventory requires 95 of those GUIDs. The newer native
   catalog additionally generated Dark, MatteMembrane, ShinyMembrane,
   DiamondMembrane and OutlinedMembrane. These five are listed as excluded
   inputs, not silently counted as passes or added to the web target.
4. [live-mesh-comparison.json](live-mesh-comparison.json) records **95/95 live
   meshes matching**, with zero mismatches, configuration errors or fixture
   errors. The report binds selected inputs to SHA-256 hashes, the installed
   comparator, the runner, the inventory, the lockfile and package revisions.
   Defaults are `1e-5` channel tolerance, `0.1` unit scale and Unity-to-Three
   handedness conversion. Existing family-specific hull/ConcaveHull rules still
   apply; this does not promise identical triangulation for those families.
5. Each native JSON also contains post-BrushBaker data and an exported-GLB
   reference. Their generation is established, but the comparator run here
   compares finalized live geometry only. It does not establish BrushBaker,
   GLB import, shader, image, animation, interaction or physical-headset parity.
   The original 95-image screenshot corpus was not regenerated or overwritten.
   [image-corpus-inventory.json](image-corpus-inventory.json) records its current
   bytes, dimensions and hashes separately, with producing revision and capture
   settings explicitly unverified.
6. The native checkout was clean before launch. After Editor initialization and
   capture, a font asset and two project-settings assets were modified, as listed
   in the manifest. Those changes were left uncommitted; the generator C# hashes
   were unchanged across the run. Do not describe the entire capture worktree as
   clean or infer screenshot provenance from this mesh run.

## Reproduce the comparison

From the web repository after `npm ci`:

```powershell
npm run compare:unity-meshes -- --fixtures 'C:\Users\andyb\Documents\open-brush-fast\Support\BrushFixtures' --output .tmp/live-mesh-comparison.json
```

The runner requires every current required GUID exactly once and reports native
extras separately. It snapshots the selected JSON bytes before comparing them.
It bundles the installed package comparator into an ignored temporary directory
because Node 24 refuses type stripping inside `node_modules`; it does not edit
the package or use a temporary dependency reference. Missing/duplicate required
inputs, incomplete coverage and comparison failures produce a nonzero exit.

To regenerate native inputs again, use the same Main-scene Play-mode menu above
through the explicitly targeted Unity Editor. Record the new revision, worktree,
generator hashes and artifact hashes as a new run. Reusing this manifest after
regeneration would misattribute the inputs.

## Checks

1. `npm run check`: typecheck and checks passed; 78 Vitest files passed,
   559 tests passed and 4 remained TODO. Four new tests guard missing, duplicate,
   empty-target and native-extra coverage handling.
2. The comparison runner was executed against all 100 fresh native JSON files;
   it selected and matched the 95 required GUIDs and reported the five extras.
