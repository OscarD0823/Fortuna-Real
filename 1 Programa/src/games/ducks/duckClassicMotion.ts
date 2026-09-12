import type { DuckContestant } from "./duckHuntEngine";

export const DUCK_FIELD_WIDTH = 960;
export const DUCK_FIELD_HEIGHT = 540;
export const DUCK_SPRITE_WIDTH = 40;
export const DUCK_SPRITE_HEIGHT = 32;

export interface ClassicDuckPose {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  facing: 1 | -1;
  frame: number;
  covered: boolean;
}

const bounce = (value: number) => 1 - Math.abs(((value % 2) + 2) % 2 - 1);
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Shared takeoff: everyone leaves cover together, regardless of roster size. */
export const classicTakeoffCover = (seconds: number) => 1 - ease((seconds - 0.16) / 0.92);

export const classicRefuge = (duck: DuckContestant) => duck.number % 4 === 0
  ? { x: 94 + duck.routeSeed * 48, y: 344, kind: "tree" as const }
  : { x: 218 + ((duck.number * 0.618 + duck.routeSeed * 0.2) % 1) * 692, y: 457, kind: "grass" as const };

/** Non-overlapping flight cells keep ALL 2–200 ducks inside the open sky.
 * Each cell contains an independent diagonal flight, reversals and wing beats.
 * This is cosmetic only: no RNG used by the sealed draw is consumed here.
 */
export const classicDuckPose = (
  duck: DuckContestant, index: number, count: number, seconds: number, cover: number,
): ClassicDuckPose => {
  const columns = Math.max(2, Math.ceil(Math.sqrt(Math.max(2, count) * 2.4)));
  const rows = Math.ceil(count / columns);
  const cellWidth = 728 / columns;
  const cellHeight = 308 / Math.max(1, rows);
  const scale = Math.min(2.25, cellWidth / 52, cellHeight / 43);
  const width = Math.floor(DUCK_SPRITE_WIDTH * scale);
  const height = Math.floor(DUCK_SPRITE_HEIGHT * scale);
  const phase = duck.routeSeed * 2 + duck.profile.phase / Math.PI + duck.dodgeX * 0.22 + duck.dodgeY * 0.12;
  const pace = seconds * (count > 40 ? 0.24 : 0.42) * duck.speed;
  const travel = pace + phase;
  const freeX = 202 + (index % columns) * cellWidth + width / 2 + 3
    + bounce(travel) * Math.max(0, cellWidth - width - 6);
  const freeY = 58 + Math.floor(index / columns) * cellHeight + height / 2 + 3
    + bounce(pace * (0.72 + duck.routeSeed * 0.4) + phase * 1.37) * Math.max(0, cellHeight - height - 6);
  const refuge = classicRefuge(duck);
  const amount = Math.max(0, Math.min(1, cover));
  return {
    id: duck.id,
    x: Math.round(freeX + (refuge.x - freeX) * amount),
    y: Math.round(freeY + (refuge.y - freeY) * amount),
    width, height,
    facing: ((travel % 2) + 2) % 2 < 1 ? 1 : -1,
    frame: ((Math.floor(seconds * (7 + duck.speed) + duck.profile.phase) % 4) + 4) % 4,
    covered: amount >= 0.94,
  };
};

/** Original pixel artwork, generated locally; not extracted from a ROM/image.
 * Palette indices also form the exact shot mask (transparent pixels never hit).
 */
export const createClassicDuckPixels = (frame: number): Uint8Array => {
  const width = DUCK_SPRITE_WIDTH;
  const height = DUCK_SPRITE_HEIGHT;
  const pixels = new Uint8Array(width * height);
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    for (let row = Math.max(0, y); row < Math.min(height, y + h); row++) {
      for (let col = Math.max(0, x); col < Math.min(width, x + w); col++) pixels[row * width + col] = color;
    }
  };
  const polygon = (points: readonly (readonly [number, number])[], color: number) => {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [ax, ay] = points[i]; const [bx, by] = points[j];
        if ((ay > y + 0.5) !== (by > y + 0.5) && x + 0.5 < (bx - ax) * (y + 0.5 - ay) / (by - ay) + ax) inside = !inside;
      }
      if (inside) pixels[y * width + x] = color;
    }
  };
  // Tail, chest, green head, white collar, orange bill and webbed feet.
  polygon([[3, 17], [12, 18], [17, 23], [7, 22]], 3);
  polygon([[10, 15], [24, 14], [29, 20], [24, 25], [13, 24], [8, 20]], 2);
  rect(19, 19, 7, 4, 3);
  rect(24, 12, 6, 8, 4);
  rect(26, 9, 7, 7, 4);
  rect(28, 9, 4, 2, 5);
  rect(24, 17, 5, 2, 6);
  rect(32, 13, 6, 3, 7);
  rect(33, 16, 3, 1, 7);
  rect(29, 11, 3, 3, 6);
  rect(30, 12, 2, 2, 1); // pupil
  rect(15, 25, 2, 2, 7);
  rect(12, 27, 5, 1, 7); // left foot
  rect(21, 24, 2, 3, 7);
  rect(18, 27, 5, 1, 7);
  const wing = frame % 4;
  if (wing === 0) {
    polygon([[12, 18], [10, 5], [14, 2], [23, 16], [21, 21]], 3);
    polygon([[13, 5], [16, 8], [21, 16], [17, 14]], 6);
    rect(11, 5, 2, 7, 8);
  } else if (wing === 2) {
    polygon([[12, 17], [24, 17], [18, 30], [12, 28], [10, 21]], 3);
    polygon([[16, 21], [21, 19], [17, 27], [14, 26]], 6);
    rect(12, 25, 2, 4, 8);
  } else {
    polygon([[10, 17], [3, 11], [8, 8], [23, 16], [21, 21]], 3);
    polygon([[7, 10], [11, 11], [19, 16], [15, 17]], 6);
    rect(4, 10, 4, 2, 8);
  }
  // One-pixel silhouette separates the duck from sky and foliage.
  const outlined = pixels.slice();
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (!pixels[i] && (pixels[i - 1] || pixels[i + 1] || pixels[i - width] || pixels[i + width])) outlined[i] = 1;
  }
  return outlined;
};

export const classicDuckPixelHit = (pose: ClassicDuckPose, x: number, y: number, pixels: Uint8Array) => {
  if (pose.covered) return false;
  let u = Math.floor((x - pose.x + pose.width / 2) / pose.width * DUCK_SPRITE_WIDTH);
  const v = Math.floor((y - pose.y + pose.height / 2) / pose.height * DUCK_SPRITE_HEIGHT);
  if (u < 0 || u >= DUCK_SPRITE_WIDTH || v < 0 || v >= DUCK_SPRITE_HEIGHT) return false;
  if (pose.facing === -1) u = DUCK_SPRITE_WIDTH - 1 - u;
  return pixels[v * DUCK_SPRITE_WIDTH + u] > 0;
};

export const pickClassicDuck = (
  poses: readonly ClassicDuckPose[], x: number, y: number,
  frames: readonly Uint8Array[], isFoliage: (x: number, y: number) => boolean,
) => {
  if (isFoliage(x, y)) return null;
  for (let i = poses.length - 1; i >= 0; i--) {
    if (classicDuckPixelHit(poses[i], x, y, frames[poses[i].frame])) return poses[i].id;
  }
  return null;
};
