# Browser brush-image diagnostics: 2026-10-21

1. Captured all **95 required brushes at 2048x2048** through the existing
   application `visual-conformance=brush` route. All PNG captures succeeded;
   94 passed its minimum coverage smoke check. ConcaveHull had zero coverage
   with the legacy planar input. [results.json](results.json) contains per-GUID
   image hashes, dimensions, silhouette/RGB metrics, input profile and coverage.
   The result is **diagnostic, not a Unity visual-parity pass**.
2. The reference PNG hashes match the previously recorded 95-image corpus.
   Browser and reference images have equal dimensions without resizing. Raw
   image pairs and all console logs remain at
   `C:\Users\andyb\Documents\brushspace\.tmp\brush-images-all-2026-10-21`.
   Oil Paint and Disco pairs are retained here as representative artifacts:
   [Oil Paint browser](OilPaint-browser.png), [Oil Paint reference](OilPaint-reference.png),
   [Disco browser](Disco-browser.png), [Disco reference](Disco-reference.png).
3. Chrome 155.0.8059.85 used ANGLE Vulkan SwiftShader. This is a desktop software
   rendering observation, not hardware timing or Quest evidence.
   [log-summary.json](log-summary.json) binds all 95 logs to hashes; no console
   errors or page errors were recorded in them. [manifest.json](manifest.json)
   binds the uncommitted-at-capture runtime/tool changes to their source hashes.
   They are versioned with this evidence; the baseline commit alone does not
   represent the modified capture code. `producingSourceCommit` identifies the
   exact published collector/runtime source used for the full run; later
   collector-contract hardening was verified separately.

## Why the metrics do not establish parity

1. The default browser fixture is the older planar screenshot path. The current
   native generator uses 36 control points with varying pressure, rotation and
   depth. The legacy browser route also contains a SingleSided orientation
   override. The supplied images' original capture revision/settings remain
   unverified; equal resolution does not establish matched inputs or framing.
2. The optional `conformance-input` path now consumes a native mesh input and
   camera profile with explicit unit/handedness conversion, preserving seed,
   pressure, rotation and timing. It rejects wrong GUIDs, unsupported canvas
   transforms, inconsistent shader time and unsupported capture settings.
   It does not automatically reproduce native lighting, color space, fog,
   post-processing or every material/shader branch.
3. [native-input-smoke.json](native-input-smoke.json) records a separate adapter
   check using the fresh Oil Paint and ConcaveHull mesh inputs and a controlled
   reference camera. Both rendered without page errors at 2048x2048. ConcaveHull
   coverage was approximately 2.72%; the [captured image](ConcaveHull-native-input-smoke.png)
   demonstrates that the legacy zero-coverage result is input-dependent, rather
   than establishing that the brush cannot render. This is not a native-image
   comparison and does not add a parity pass.
4. A separate experimental paired native capture reused private
   `UiScreenshotter` helpers, writing to an isolated local directory. It stopped
   after seven captures when the Editor exited with a native crash. The first
   frame was effectively blank, camera metadata differed from the initialized
   reference pose, and the log contained duplicate `UniversalCameraData`
   exceptions. The native stack included GameView camera rendering. The cause
   remains unproven; this does not establish that the standard screenshot menu
   itself crashes. Those images were rejected, the supplied corpus was not
   replaced, and no native production source was patched. See
   [rejected-native-capture.json](rejected-native-capture.json).

## Reproduce

After `npm ci` and `npm run build`, check for an existing IWSDK runtime before
starting a development server. The collector can use its URL through `--url`.
Without that option it starts and stops its own production-preview process:

```powershell
npm run compare:brush-images -- --references 'C:\Users\andyb\Documents\open-brush-fast\Support\Screenshots\brushes-postfx-disabled' --output .tmp/new-brush-image-run
```

The destination must be new. Use repeated `--brush OilPaint --brush Disco` for
an explicitly reported subset. `--paired <directory>` requires a completed native
capture with `status.json`, `fixtures/*.mesh.json` and `fixtures/*.capture.json`;
it serves that selected input to the application through an intercepted
same-origin request. Failed or partial native runs are rejected before browser
launch. A native profile bypasses legacy per-brush control-point mutations.

The collector preserves GPU readback RGB on black when encoding PNGs, matching
the native screenshot helper's RGB24 output even if target alpha is zero. Every
captured PNG's coverage was checked against GPU readback coverage to detect
canvas/PNG conversion loss. It reports metrics without assigning calibrated
image-error thresholds. Missing captures or coverage-smoke failures return a
nonzero exit; an isolated ConcaveHull legacy negative control returned exit 1
while retaining its diagnostic output.

Subsequent collector hardening rejects missing/nonfinite GPU coverage, unknown
input profiles, invalid dimensions/status and absent PNG data. Console/page errors
are surfaced in each row and prevent a clean capture result. This avoids treating
an older incompatible runtime as trustworthy evidence. A subsequent Oil Paint
browser smoke passed with that stricter contract; the full 95-image report remains
bound to its original producing source rather than being relabelled as a new run.

## Checks and next work

1. The capture build passed typecheck, checks, 79 Vitest files (565 tests passed,
   4 TODOs) and production build. After collector hardening, the complete checks
   passed with 80 Vitest files, 569 tests passed and 4 TODOs.
2. Native-input conversion, invalid profiles, bounded capture sizes and opaque
   readback encoding have six focused tests. The native-input browser smoke and
   the failed-native-reference rejection were also exercised.
3. Establish a reliable native capture with frozen camera/projection and paired
   inputs before calibrating differences or changing brush geometry/shaders to
   fit these images. Export-stage validation and per-GUID evidence aggregation
   remain separate work in the main plan.
