export interface BrushAudioReactivity {
  /** The native picker advertises an audio-reactive variant. */
  nativeTagged: boolean;
  /** Current maintained shader path has no native audio signal bindings. */
  mode: "non-reactive";
}

/** Drawing sound effects and time-driven animation do not establish audio
 * reactivity. Keep native intent separate from the implemented rendering mode. */
export function getBrushAudioReactivity(tags: readonly string[]): BrushAudioReactivity {
  return { nativeTagged: tags.includes("audioreactive"), mode: "non-reactive" };
}

/** Lexical source audit only: signal names are supplied from the pinned native
 * visualizer. Comments must not turn omitted native code into input evidence. */
export function inspectBrushAudioInputs(text: string, nativeInputs: readonly string[]) {
  const source = text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const uniforms = [...source.matchAll(/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+(\w+)/g)].map(match => match[1]);
  return {
    audioUniforms: uniforms.filter(name => /audio|beat|fft|waveform|peakband/i.test(name)),
    nativeInputReferences: nativeInputs.filter(name => new RegExp(`\\b(?:u)?${name}\\b`).test(source)),
  };
}
