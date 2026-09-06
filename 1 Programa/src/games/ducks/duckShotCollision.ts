import type { Intersection, Object3D } from "three";

/** Intersections arrive front-to-back: foliage stops the ray; hidden ducks never count. */
export const pickVisibleDuckInstance = (
  intersections: readonly Intersection[],
  duckParts: ReadonlySet<Object3D>,
  isVisibleTarget: (instance: number) => boolean,
): number | null => {
  for (const intersection of intersections) {
    if (!duckParts.has(intersection.object)) return null;
    const instance = intersection.instanceId;
    if (instance !== undefined && isVisibleTarget(instance)) return instance;
  }
  return null;
};
