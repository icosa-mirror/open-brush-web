/** Reject old/incompatible runtimes rather than accepting NaN or missing metadata as evidence. */
export function validateBrushCapture(capture, size, nativeInput) {
  if (capture.width !== size || capture.height !== size) throw new Error("Browser capture dimensions differ from the unmodified reference.");
  const expected = nativeInput ? "native-capture" : "legacy-screenshot-fixture";
  if (capture.profile !== expected) throw new Error(`Browser capture input profile must be ${expected}; rebuild or use the matching runtime.`);
  if (!Number.isFinite(capture.coverage) || capture.coverage < 0 || capture.coverage > 1) throw new Error("GPU readback coverage is missing or invalid.");
  if (!["pass", "fail"].includes(capture.renderStatus)) throw new Error("Browser capture status is missing or invalid.");
  if (typeof capture.png !== "string" || !capture.png.startsWith("data:image/png;base64,")) throw new Error("Browser did not produce a PNG capture.");
}
