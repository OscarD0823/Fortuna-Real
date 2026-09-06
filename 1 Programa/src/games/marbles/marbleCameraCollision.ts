import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Spatially partition the static solids so each camera ray only tests nearby triangles. */
export const createCameraCollisionCells = (objects: readonly THREE.Mesh[]) => {
  const cells = new Map<string, number[]>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  objects.forEach((object) => {
    const positions = object.geometry.getAttribute("position");
    if (!positions) return;
    const indices = object.geometry.index;
    const count = indices?.count ?? positions.count;
    for (let index = 0; index + 2 < count; index += 3) {
      a.fromBufferAttribute(positions, indices ? indices.getX(index) : index).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(positions, indices ? indices.getX(index + 1) : index + 1).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(positions, indices ? indices.getX(index + 2) : index + 2).applyMatrix4(object.matrixWorld);
      const key = `${Math.floor((a.x + b.x + c.x) / 12)}:${Math.floor((a.z + b.z + c.z) / 12)}`;
      const vertices = cells.get(key) ?? [];
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      cells.set(key, vertices);
    }
  });
  return [...cells.values()].map((positions) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const cell = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    cell.updateMatrixWorld(true);
    return cell;
  });
};

/** A small, invisible collision model: decks and guardrails, without decorative bolts. */
export const createCameraTrackCollider = (
  samples: readonly { position: THREE.Vector3 }[], width: number,
) => {
  const pieces: THREE.BufferGeometry[] = [];
  const direction = new THREE.Vector3();
  const center = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 0, 1);
  const side = new THREE.Vector3();
  for (let index = 1; index < samples.length; index += 1) {
    const a = samples[index - 1].position;
    const b = samples[index].position;
    direction.subVectors(b, a);
    const length = direction.length();
    if (length < 0.001) continue;
    direction.divideScalar(length);
    rotation.setFromUnitVectors(axis, direction);
    center.copy(a).lerp(b, 0.5);
    const deck = new THREE.BoxGeometry(width + 0.25, 0.36, length + 0.06);
    deck.translate(0, -0.2, 0).applyQuaternion(rotation).translate(center.x, center.y, center.z);
    pieces.push(deck);
    side.set(direction.z, 0, -direction.x).normalize();
    for (const sign of [-1, 1]) {
      const wall = new THREE.BoxGeometry(0.16, 0.5, length + 0.06);
      wall.applyQuaternion(rotation).translate(
        center.x + side.x * width * 0.53 * sign,
        center.y + 0.22,
        center.z + side.z * width * 0.53 * sign,
      );
      pieces.push(wall);
    }
  }
  const geometry = pieces.length ? mergeGeometries(pieces, false)! : new THREE.BufferGeometry();
  pieces.forEach((piece) => piece.dispose());
  const collider = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  collider.updateMatrixWorld(true);
  return collider;
};

/** Retract the camera before a deck/rail, never through it to see the marble. */
export const constrainCameraSightline = (
  origin: THREE.Vector3, position: THREE.Vector3, collider: THREE.Mesh | THREE.Mesh[],
  raycaster: THREE.Raycaster, hits: THREE.Intersection[],
) => {
  const distance = origin.distanceTo(position);
  if (distance < 0.001) return false;
  raycaster.ray.origin.copy(origin);
  raycaster.ray.direction.subVectors(position, origin).divideScalar(distance);
  raycaster.near = 0;
  raycaster.far = distance + 0.28;
  hits.length = 0;
  if (Array.isArray(collider)) raycaster.intersectObjects(collider, false, hits);
  else raycaster.intersectObject(collider, false, hits);
  const hit = hits[0];
  if (!hit) return false;
  const safeDistance = Math.max(0, Math.min(distance, hit.distance - 0.28));
  position.copy(origin).addScaledVector(raycaster.ray.direction, safeDistance);
  return safeDistance < distance;
};
