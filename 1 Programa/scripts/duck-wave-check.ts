import assert from "node:assert/strict";
import {
  DUCK_WAVE_SHOTS,
  countDuckHitLamps,
  getDuckPassLine,
  getDuckWaveDuration,
  selectDuckWaveIds,
} from "../src/games/ducks/duckWaveEngine.ts";

const living = ["a", "b", "c", "d", "e"];
assert.deepEqual(selectDuckWaveIds(living, 1, "single"), ["a"]);
assert.deepEqual(selectDuckWaveIds(living, 6, "single"), ["a"]);
assert.deepEqual(selectDuckWaveIds(living, 1, "double"), ["a", "b"]);
assert.deepEqual(selectDuckWaveIds(living, 2, "double"), ["c", "d"]);
assert.deepEqual(selectDuckWaveIds(["a"], 8, "double"), ["a"]);
assert.deepEqual(selectDuckWaveIds(living, 1, "flock"), living);
assert.equal(new Set(selectDuckWaveIds(living, 4, "flock")).size, 5);
assert.deepEqual(selectDuckWaveIds(["a", "b"], 1, "flock"), ["a", "b"]);
for (let count = 2; count <= 200; count++) {
  const ids = Array.from({ length: count }, (_, i) => `duck-${i}`);
  for (const wave of [1, 2, 17, 200]) {
    const selected = selectDuckWaveIds(ids, wave, "flock");
    assert.deepEqual(selected, ids, "Todos los participantes deben salir, no solo los primeros cinco.");
    assert.notEqual(selected, ids, "No se debe compartir una lista mutable con el estado de la ronda.");
    assert.deepEqual(selectDuckWaveIds(ids.slice(1), wave, "flock"), ids.slice(1), "Los eliminados no reaparecen.");
  }
}
assert.deepEqual(selectDuckWaveIds([], 1, "flock"), []);
assert.equal(DUCK_WAVE_SHOTS, 3);
assert.equal(getDuckWaveDuration(1), 10_000);
assert.equal(getDuckWaveDuration(100), 6_000);
assert.equal(countDuckHitLamps([true, false, true]), 2);
assert.equal(countDuckHitLamps(Array(12).fill(true)), 10);
assert.equal(getDuckPassLine(1), 6);
assert.equal(getDuckPassLine(30), 9);

console.log(JSON.stringify({ waves: "passed", shots: DUCK_WAVE_SHOTS, minimumTimeMs: getDuckWaveDuration(100) }));
