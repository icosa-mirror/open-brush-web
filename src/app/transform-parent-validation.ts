import { World, Transform } from "@iwsdk/core";
import { TransformParentCompatibilitySystem } from "../systems/transform-parent-compatibility-system.js";

function check(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }

export async function validateTransformParents(container: HTMLDivElement) {
  const world = await World.create(container, { xr: false, render: { defaultLighting: false }, features: { spatialUI: false, locomotion: false, grabbing: false, physics: false } });
  const frames = async () => { for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); };
  let parent = world.createTransformEntity();
  const child = world.createTransformEntity(undefined, parent);
  await frames();
  check(child.getValue(Transform, "parent") === parent, "Fresh parent control failed");
  // Also exercise registration after existing entities have attached transforms.
  world.registerSystem(TransformParentCompatibilitySystem);
  const newcomer = world.createTransformEntity(undefined, parent); await frames();
  check(newcomer.getValue(Transform, "parent") === parent && newcomer.object3D!.parent === parent.object3D, "Compatibility layer overwrote a newly declared parent");
  newcomer.destroy();
  const index = parent.index;
  let lastGeneration = parent.generation;
  for (let cycle = 0; cycle < 16; cycle++) {
    child.setValue(Transform, "parent", world.sceneEntity); await frames();
    check(child.object3D!.parent === world.scene, "Child could not leave a recycled parent");
    parent.destroy(); parent = world.createTransformEntity(); await frames();
    check(parent.index === index && parent.generation > lastGeneration, "Parent slot was not reused");
    lastGeneration = parent.generation;
    if (cycle % 2) parent.object3D!.add(child.object3D!);
    else child.setValue(Transform, "parent", parent);
    const packed = world.entityManager.packEntityRef(parent);
    check(child.getValue(Transform, "parent") === parent && Transform.data.parent[child.index] === packed, "Immediate parent reference lost its generation");
    await frames();
    check(child.getValue(Transform, "parent") === parent && Transform.data.parent[child.index] === packed && child.object3D!.parent === parent.object3D, "Post-frame parent reference lost its generation");
  }
  child.removeComponent(Transform); await frames();
  check(Object.getOwnPropertyDescriptor(child.object3D!, "parent")?.set === undefined, "Transform detach retained a compatibility accessor");
  child.addComponent(Transform, { parent }); await frames();
  check(child.getValue(Transform, "parent") === parent && child.object3D!.parent === parent.object3D, "Reattached transform lost its parent");
  return { passed: true, reuseCycles: 16, finalGeneration: lastGeneration, existingEntityReplay: true,
    ecsAndObjectParentPaths: true, immediateAndPostFrameResolution: true, reparentAway: true, detachReattach: true,
    scope: "Pinned SDK plus application compatibility layer, repeated entity reuse and transform lifecycle; no dependency source edits, native pixels or physical XR" };
}
