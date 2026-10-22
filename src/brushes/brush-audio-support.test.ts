import { expect, it } from "vitest";
import { inspectBrushAudioInputs } from "./brush-audio-support.js";

it("ignores audio references in comments instead of treating omitted behavior as shader inputs", () => {
  expect(inspectBrushAudioInputs("// uniform vec4 u_BeatOutput;\n/* _AudioVolume */\nuniform vec4 u_time;", ["_BeatOutput", "_AudioVolume"]))
    .toEqual({ audioUniforms: [], nativeInputReferences: [] });
});

it("detects native audio globals and maintained uniform names, including precision qualifiers", () => {
  expect(inspectBrushAudioInputs("uniform highp vec4 u_BeatOutput; uniform sampler2D u_FFTTex; void main() { color *= _AudioVolume.x; }", ["_BeatOutput", "_FFTTex", "_AudioVolume"]))
    .toEqual({ audioUniforms: ["u_BeatOutput", "u_FFTTex"], nativeInputReferences: ["_BeatOutput", "_FFTTex", "_AudioVolume"] });
});
