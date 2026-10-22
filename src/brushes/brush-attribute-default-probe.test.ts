import { describe, expect, it } from "vitest";
import { compareProbeRgb } from "./brush-attribute-default-probe.js";

describe("attribute-default probe RGB comparison",()=>{
  it("counts even one-byte additive RGB changes when both alpha values are zero",()=>{
    expect(compareProbeRgb(new Uint8Array([0,0,0,0]),new Uint8Array([1,0,0,0]))).toEqual({changedPixels:1,maxByteDifference:1});
  });
  it("ignores alpha changes and rejects incomplete or differently sized buffers",()=>{
    expect(compareProbeRgb(new Uint8Array([2,3,4,0]),new Uint8Array([2,3,4,255]))).toEqual({changedPixels:0,maxByteDifference:0});
    expect(()=>compareProbeRgb(new Uint8Array(3),new Uint8Array(3))).toThrow("equally sized RGBA");
  });
});
