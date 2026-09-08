import type { MarbleTrack } from "../src/games/marbles/marbleRaceEngine.ts";

type Point = { x: number; y: number };
const distanceToSegment = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const segmentDistance = (a: Point, b: Point, c: Point, d: Point) => {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b));
};

/** Check actual deck edges, not the old assumption that every map has rows. */
export function measureMarbleTrackSpace(track: MarbleTrack) {
  const points = track.points.map(p => ({ x: p.x * 28 * track.mapScale, y: p.y * 21 * track.mapScale }));
  const distances = [0];
  points.slice(1).forEach((p, i) => distances.push(distances[i] + Math.hypot(p.x - points[i].x, p.y - points[i].y)));
  const width = track.trackWidth / 33;
  let minimumGap = Infinity;
  let minimumCrossingClearance = Infinity;
  let comparisons = 0;
  let crossings = 0;
  for (let i = 1; i < points.length; i += 1) for (let j = i + 2; j < points.length; j += 1) {
    // A continuous local bend is not a separate level/corridor.
    if (distances[j - 1] - distances[i] < Math.max(14, width * 4 + 6)) continue;
    const gap = segmentDistance(points[i - 1], points[i], points[j - 1], points[j]) - width;
    minimumGap = Math.min(minimumGap, gap);
    comparisons += 1;
    if (gap <= 0) {
      crossings += 1;
      const upperBottom = Math.min(track.points[i - 1].elevation ?? 0, track.points[i].elevation ?? 0) - 0.64;
      const lowerTop = Math.max(track.points[j - 1].elevation ?? 0, track.points[j].elevation ?? 0);
      minimumCrossingClearance = Math.min(minimumCrossingClearance, upperBottom - lowerTop);
    }
  }
  return { minimumGap, minimumCrossingClearance, comparisons, crossings };
}
