interface CameraPathPoint {
  position: { x: number; y: number; z: number };
}

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
