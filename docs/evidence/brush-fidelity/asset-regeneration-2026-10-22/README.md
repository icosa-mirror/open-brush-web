# Brush asset regeneration: 2026-10-22

1. `npm run check:brush-regeneration` regenerates assets into a unique temporary
   directory, leaving application outputs untouched. It checks the reference
   revision against `open-brush-reference.json` and rejects tracked reference
   modifications. Source traversal is sorted so descriptor insertion order
   does not depend on the host filesystem.
2. [regeneration-results.json](regeneration-results.json) records 476 generated
   files and 476 checked-in files with zero missing, extra or byte differences.
   It covers extracted shader, texture and icon directories, NOTICE and the
   two generated brush manifests. Other authored public assets and mirrored
   maintained-package assets are outside this extractor's output contract.
   Every compared file has expected and generated SHA-256 values.
3. The deployment workflow checks out the exact native commit from the reference
   pin and runs this comparison before application checks/build. It retains
   comparison and extraction diagnostics as a CI artifact. Temporary generated
   outputs and logs also remain locally for diagnosis. This evidence is from
   Windows; Linux CI execution has not yet been verified.
4. A regression compares binary files and proves that a one-byte mutation,
   absent generated file and newly generated file produce distinct failures.
   Full application checks pass: 90 test files, 617 tests and four TODOs.
   No runtime code changed; a new browser or headset run was not needed for
   this extraction gate. [manifest.json](manifest.json) binds the checker,
   extractor, workflow, pin, package manifest, evidence and full-check log.

The producing baseline was `c0fa872`; per-file hashes identify the tested
working-tree changes. Reproduction proves deterministic extraction against the
declared source. It does not prove the source/render mapping is faithful,
advance the native reference pin, or close native image and physical XR gates.

```powershell
npm run check:brush-regeneration
```
