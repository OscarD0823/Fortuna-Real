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
assert.equal(DUCK_WAVE_SHOTS, 3);
assert.equal(getDuckWaveDuration(1), 10_000);
assert.equal(getDuckWaveDuration(100), 6_000);
assert.equal(countDuckHitLamps([true, false, true]), 2);
assert.equal(countDuckHitLamps(Array(12).fill(true)), 10);
assert.equal(getDuckPassLine(1), 6);
assert.equal(getDuckPassLine(30), 9);

console.log(JSON.stringify({ waves: "passed", shots: DUCK_WAVE_SHOTS, minimumTimeMs: getDuckWaveDuration(100) }));
