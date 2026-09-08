interface CameraPathPoint {
  position: { x: number; y: number; z: number };
}

/** Include every corner, even while the overview moves out from the start bay. */
export const cameraFarDistance = (
  eye: CameraPathPoint["position"],
  bounds: { min: CameraPathPoint["position"]; max: CameraPathPoint["position"] },
) => {
  const dx = Math.max(Math.abs(bounds.min.x - eye.x), Math.abs(bounds.max.x - eye.x));
  const dy = Math.max(Math.abs(bounds.min.y - eye.y), Math.abs(bounds.max.y - eye.y));
  const dz = Math.max(Math.abs(bounds.min.z - eye.z), Math.abs(bounds.max.z - eye.z));
  return Math.max(90, Math.ceil(Math.hypot(dx, dy, dz) + 10));
};

/** A background/resumed window must not chase a position from seconds ago. */
export const marbleCameraResponse = (elapsedMs: number, responseMs: number, reducedMotion = false) =>
  reducedMotion || elapsedMs >= 250 ? 1 : 1 - Math.exp(-Math.max(0, elapsedMs) / responseMs);

/** Shorten the trailing boom in bends, and leave more of the next turn in view. */
export const marbleChaseFraming = (tangentAlignment: number, speed: number) => {
  const bend = Math.max(0, Math.min(1, (1 - tangentAlignment) / 0.85));
  const pace = Math.max(0, Math.min(1, speed));
  return {
    distance: 5.4 + pace * 0.9 - bend * 1.5,
    height: 2.65 + pace * 0.25 + bend * 0.7,
    anticipation: 0.2 + bend * 0.12,
    fov: 61 + pace * 3 + bend * 3,
  };
};

/** World-space distances keep the framing identical on short and long circuits. */
export const measureCameraPath = (samples: readonly CameraPathPoint[]) => {
  const distances = new Float64Array(samples.length);
  for (let index = 1; index < samples.length; index += 1) {
    const a = samples[index - 1].position;
    const b = samples[index].position;
    distances[index] = distances[index - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return distances;
};

export const offsetCameraProgress = (distances: Float64Array, progress: number, offset: number) => {
  if (distances.length < 2 || distances[distances.length - 1] === 0) return 0;
  const last = distances.length - 1;
  const sample = Math.max(0, Math.min(1, progress)) * last;
  const index = Math.min(last - 1, Math.floor(sample));
  const distance = distances[index] + (distances[index + 1] - distances[index]) * (sample - index);
  const target = Math.max(0, Math.min(distances[last], distance + offset));
  let low = 0;
  let high = last;
  while (low + 1 < high) {
    const middle = (low + high) >>> 1;
    if (distances[middle] < target) low = middle;
    else high = middle;
  }
  const span = distances[high] - distances[low];
  return (low + (span > 0 ? (target - distances[low]) / span : 0)) / last;
};

/** Check entire deck segments, including crossings between sparse samples. */
export const cameraPathCeiling = (
  samples: readonly CameraPathPoint[], referenceY: number, x: number, z: number, radius: number,
) => {
  let ceiling = Number.POSITIVE_INFINITY;
  for (let index = 1; index < samples.length; index += 1) {
    const a = samples[index - 1].position;
    const b = samples[index].position;
    if (Math.max(a.y, b.y) < referenceY + 2.45) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / lengthSq));
    const y = a.y + (b.y - a.y) * t;
    if (y >= referenceY + 2.45 && (a.x + dx * t - x) ** 2 + (a.z + dz * t - z) ** 2 <= radius * radius) {
      ceiling = Math.min(ceiling, y);
    }
  }
  return ceiling;
};
