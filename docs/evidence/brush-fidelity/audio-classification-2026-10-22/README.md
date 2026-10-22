# Current audio modes: source classification, 2026-10-22

1. [source-audit.json](source-audit.json) classifies all 95 required brushes as
   currently non-reactive. Thirty-five retain native `audioreactive` picker
   tags. The inventory now exposes `audioReactivity.nativeTagged` separately
   from `audioReactivity.mode`, so source intent and implemented rendering do
   not become the same claim. Existing native tags and picker membership stay
   intact. Time-driven animation and drawing sounds are separate behaviors.
2. The audit reads the six native global inputs from the declared reference's
   `VisualizerManager`: waveform texture, FFT texture, beat output, accumulated
   beat output, audio volume and peak-band levels. It checks runtime asset
   revision `df593c972751f7f28bc8d47bc4f4fd8cfad45fe5` against the URL resolver,
   application gitlink and clean submodule checkout, then scans that exact
   authoritative asset corpus. All 226 GLSL files have per-file SHA-256 values.
   No known native-input references or audio-named uniforms remain after
   stripping comments. This includes the DanceFloor shader whose comment
   explicitly identifies an omitted beat term.
3. The scanner is a lexical source check. Positive controls detect precision-
   qualified beat uniforms, FFT textures and direct native signal references.
   Comment-only controls prevent omitted code from becoming evidence of audio
   support. New signal matches stop the audit for review; they do not silently
   enable reactive classification. Native signal processing, audio capture and
   actual shader response are outside this source check.
4. CI now runs `npm run audit:brush-audio` after pinned native checkout and asset
   regeneration. The JSON report is retained with the brush source diagnostics.
   [The Linux CI run](https://github.com/icosa-mirror/open-brush-web/actions/runs/39722513243)
   now passes the audit and full workflow. [CI source results](ci-source-audit.json)
   match the local classifications, counts and native inputs; [CI verification](ci-verification.json)
   binds the run and report. Local checks pass:
   93 files, 629 tests and four TODOs; the mirror build passes.
5. [manifest.json](manifest.json) binds the audit, classification module,
   inventory integration, tests, workflow, package manifest and local check
   logs. The baseline was `1ae70ec`. Local full checks also included the three
   uncommitted selection-canvas source files listed separately in the manifest;
   these checks do not override their known dependency/runtime failure. That
   work is not part of the audio-classification commit.

This implements explicit classification of the current missing audio mode.
Full parity still requires the native signal-processing contract, controlled
audio inputs, corresponding maintained shader variants and matched native/web
response evidence. The source audit is not an audio-reactivity pass, a visual
parity pass, or evidence of physical-headset behavior. Custom external asset
URL overrides are outside this pinned-corpus classification.

With the declared native reference and asset submodule present:

```powershell
npm run audit:brush-audio
```
