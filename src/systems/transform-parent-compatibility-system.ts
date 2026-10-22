import { createSystem, Transform, type Entity, type Object3D } from "@iwsdk/core";

/** IWSDK 0.4.2 writes raw Object3D entity indices into Types.Entity fields.
 * Preserve its setter, then use the public ECS setter to retain generation bits.
 * This runs on parenting/lifecycle events, not once per frame. Remove when the
 * SDK passes the recycled-parent regression without this compatibility layer. */
export class TransformParentCompatibilitySystem extends createSystem({
  transforms: { required: [Transform] },
}) {
  private readonly bindings = new WeakMap<Object3D, {
    original: PropertyDescriptor;
    setter: (parent: Object3D | null) => void;
  }>();

  init() {
    this.cleanupFuncs.push(
      this.queries.transforms.subscribe("qualify", entity => this.attach(entity), true),
      this.queries.transforms.subscribe("disqualify", entity => this.detach(entity)),
    );
  }

  private attach(entity: Entity): void {
    const object = entity.object3D;
    if (!object || this.bindings.has(object)) return;
    const original = Object.getOwnPropertyDescriptor(object, "parent");
    if (!original?.get || !original.set || !original.configurable) {
      throw new Error("Open Brush parent compatibility requires the IWSDK Transform parent accessor.");
    }
    const synchronize = (parent: Object3D | null) => {
      const index = (parent as (Object3D & { entityIdx?: number }) | null)?.entityIdx;
      const parentEntity = index === undefined ? null : this.world.entityManager.getEntityByIndex(index);
      entity.setValue(Transform, "parent", parentEntity);
    };
    const setter = (parent: Object3D | null) => {
      original.set!.call(object, parent);
      synchronize(parent);
    };
    Object.defineProperty(object, "parent", { ...original, set: setter });
    this.bindings.set(object, { original, setter });
    // New entities can have a declared ECS parent before TransformSystem has
    // applied it to Object3D. Preserve that pending assignment. Only repair an
    // existing object parent when the ECS reference is currently unresolved.
    if (!entity.getValue(Transform, "parent") && object.parent) synchronize(object.parent);
  }

  private detach(entity: Entity): void {
    const object = entity.object3D;
    if (!object) return;
    const binding = this.bindings.get(object);
    // The SDK normally detaches first and restores its own plain parent field.
    if (binding && Object.getOwnPropertyDescriptor(object, "parent")?.set === binding.setter) {
      Object.defineProperty(object, "parent", binding.original);
    }
    this.bindings.delete(object);
  }

  destroy() {
    super.destroy();
    for (const entity of this.queries.transforms.entities) this.detach(entity);
  }
}
