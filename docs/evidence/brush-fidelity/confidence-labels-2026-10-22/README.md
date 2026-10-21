# Separate brush availability from visual confidence: 2026-10-22

1. Inventory previously assigned `likely-mostly-correct` whenever a supported
   renderer path existed, then used that confidence to enable painting. That
   inferred visual fidelity from implementation eligibility. The inventory now
   records visual confidence as `unverified` and enables painting directly from
   support status. No matched Unity image evidence exists to promote a brush's
   visual confidence yet; live-mesh matches do not justify that promotion.
2. Both initial UIKITML and the active-selection label now say **Visual parity
   unverified**. Catalog regression coverage verifies that all 95 required
   brushes remain selectable with that confidence, alongside the existing
   48-standard/95-total catalog checks. Unsupported renderer paths retain their
   prior disabled behavior. Asset loading/material warmup continues to use its
   existing eligibility rules.
3. [panel-preview.png](panel-preview.png) shows the compiled panel in an isolated
   900x900 ScreenSpace preview using Chrome 155.0.8059.85/SwiftShader. The caption
   fits on one line; no browser/page error occurred. This preview checks initial
   markup and layout, not live selection or XR interaction. Its temporary world
   and browser were closed; ScreenSpace was not added to the application panel.
4. TypeScript, production mirror build and the full repository check passed:
   82 Vitest files, 579 passed tests and four existing TODOs. This change corrects
   a confidence claim; it adds no Unity visual-parity pass. Per-GUID compile,
   image, XR/device and performance evidence remains separate unfinished work.
