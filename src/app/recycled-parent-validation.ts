import { World, Transform } from "@iwsdk/core";

function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }

/** Diagnostic success means the dependency defect was reproduced, not fixed. */
export async function diagnoseRecycledParent(container: HTMLDivElement) {
  const world = await World.create(container, { xr: false, render: { defaultLighting: false }, features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  const frames = async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };
  const original = world.createTransformEntity();
  const child = world.createTransformEntity(undefined, original);
  await frames();
  const initialParentResolves = child.getValue(Transform, "parent") === original;
  check(initialParentResolves, "Fresh parent control failed");
  child.setValue(Transform, "parent", world.sceneEntity); await frames();
  const originalIndex = original.index;
  original.destroy();
  const replacement = world.createTransformEntity(); await frames();
  check(replacement.index === originalIndex && replacement.generation > 0, "Fixture did not recycle the parent slot");
  child.setValue(Transform, "parent", replacement);
  const resolvesImmediately = child.getValue(Transform, "parent") === replacement;
  const beforeUpdate = Number(Transform.data.parent[child.index]);
  await frames();
  const afterUpdate = Number(Transform.data.parent[child.index]);
  const resolvesAfterUpdate = child.getValue(Transform, "parent") === replacement;
  const objectParentMatches = child.object3D!.parent === replacement.object3D;
  const reproduced = resolvesImmediately && !resolvesAfterUpdate && objectParentMatches && afterUpdate === replacement.index && beforeUpdate !== afterUpdate;
  check(reproduced, "Packed-reference failure did not reproduce; inspect the current dependency versions");
  return { passed: reproduced, reproduced, initialParentResolves, replacementIndex: replacement.index, generation: replacement.generation,
    resolvesImmediately, beforeUpdate, afterUpdate, resolvesAfterUpdate, objectParentMatches,
    scope: "Minimal IWSDK/ECS diagnostic. Success records an existing dependency defect, not a passing parenting or fidelity gate." };
}
