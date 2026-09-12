import assert from "node:assert/strict";
import { classicDuckPose, classicTakeoffCover, createClassicDuckPixels, classicDuckPixelHit, pickClassicDuck, DUCK_SPRITE_WIDTH, DUCK_SPRITE_HEIGHT } from "../src/games/ducks/duckClassicMotion.ts";
import { prepareDuckContestants, getDuckCoverAmount } from "../src/games/ducks/duckHuntEngine.ts";

const sprites = Array.from({ length: 4 }, (_, i) => createClassicDuckPixels(i));
for (const pixels of sprites) {
  assert.equal(pixels.length, DUCK_SPRITE_WIDTH * DUCK_SPRITE_HEIGHT);
  assert.ok(pixels.filter(Boolean).length > 200);
  assert.equal(pixels[0], 0);
}
assert.notDeepEqual(sprites[0], sprites[2], "Las alas deben cambiar de silueta, no ser un dibujo inmóvil.");
assert.equal(classicTakeoffCover(0), 1);
assert.equal(classicTakeoffCover(1.1), 0);
let positionsTested = 0;
for (const count of [2, 8, 24, 60, 120, 200]) {
  const ducks = prepareDuckContestants(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Persona ${i}`, color: "#fff" })), `retro-${count}`);
  for (const seconds of [0, 1.1, 1.5, 2.3, 4.5, 7.1, 15, 37]) {
    const poses = ducks.map((duck, i) => classicDuckPose(duck, i, count, seconds, 0));
    poses.forEach(pose => {
      assert.ok(pose.x - pose.width / 2 >= 202 && pose.x + pose.width / 2 <= 930);
      assert.ok(pose.y - pose.height / 2 >= 58 && pose.y + pose.height / 2 <= 366);
      assert.ok(pose.width >= 20 && pose.height >= 16, "No reducir las bandadas grandes a puntos.");
      assert.ok(pose.frame >= 0 && pose.frame < 4 && Number.isInteger(pose.frame));
      positionsTested++;
    });
    for (let i = 0; i < poses.length; i++) for (let j = i + 1; j < poses.length; j++) {
      const a = poses[i]; const b = poses[j];
      assert.ok(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 || Math.abs(a.y - b.y) >= (a.height + b.height) / 2,
        `No apilar los objetivos ${i} y ${j} de ${count} durante el vuelo libre.`);
    }
  }
  const initial = ducks.map((duck, i) => classicDuckPose(duck, i, count, 0, classicTakeoffCover(0)));
  assert.ok(initial.every(pose => pose.covered));
  const launched = ducks.map((duck, i) => classicDuckPose(duck, i, count, 1.5, Math.max(classicTakeoffCover(1.5), getDuckCoverAmount(duck, 1.5))));
  assert.equal(launched.filter(pose => !pose.covered).length, count, "Todos despegan en la primera tanda, incluidos los últimos de la lista.");
}
const duck = prepareDuckContestants([{ id: "a", name: "Ana", color: "#fff" }], "pixel-hit")[0];
const pose = { ...classicDuckPose(duck, 0, 2, 2, 0), x: 300, y: 200, width: 80, height: 64, frame: 0 };
for (const coordinate of [NaN, Infinity, -Infinity, -1000, 10000]) {
  assert.equal(classicDuckPixelHit(pose, coordinate, 200, sprites[0]), false);
  assert.equal(classicDuckPixelHit(pose, 300, coordinate, sprites[0]), false);
}
for (const facing of [-1, 1] as const) {
  const target = { ...pose, facing };
  for (let y = 0; y < DUCK_SPRITE_HEIGHT; y++) for (let x = 0; x < DUCK_SPRITE_WIDTH; x++) {
    const px = target.x - target.width / 2 + (x + 0.5) * 2;
    const py = target.y - target.height / 2 + (y + 0.5) * 2;
    const expected = sprites[0][y * DUCK_SPRITE_WIDTH + (facing === 1 ? x : DUCK_SPRITE_WIDTH - 1 - x)] !== 0;
    assert.equal(classicDuckPixelHit(target, px, py, sprites[0]), expected, "El disparo coincide con el píxel visible incluso mirando a la izquierda.");
    assert.equal(pickClassicDuck([target], px, py, sprites, () => true), null, "El pasto y el árbol bloquean todos los disparos.");
    assert.equal(classicDuckPixelHit({ ...target, covered: true }, px, py, sprites[0]), false);
    if (expected) assert.equal(pickClassicDuck([target, { ...target, id: "front" }], px, py, sprites, () => false), "front");
  }
}
console.log(JSON.stringify({ classicDuckMotion: true, positionsTested, fullFlockUpTo: 200, originalWingFrames: 4, pixelAccurateHits: true, coverBlocksShots: true }));
