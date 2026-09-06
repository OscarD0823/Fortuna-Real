import * as THREE from "three";

/** A quaternion needs a right-handed rotation, not the reflected lane-normal frame. */
export const trackFrameQuaternion = (
  up: THREE.Vector3, tangent: THREE.Vector3, target = new THREE.Quaternion(),
) => {
  const forward = tangent.clone().normalize();
  const right = new THREE.Vector3().crossVectors(up, forward).normalize();
  const orthogonalUp = new THREE.Vector3().crossVectors(forward, right).normalize();
  return target.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, orthogonalUp, forward)).normalize();
};
