import assert from "node:assert/strict";
import { prepareMarbleRace, getMarbleMotion } from "../src/games/marbles/marbleRaceEngine.ts";
import { activeMarbleWeather, marbleWeatherEnvelope, marbleWeatherTime } from "../src/games/marbles/marbleWeather.ts";

let schedules = 0, samples = 0;
for (const difficulty of ["easy", "medium", "hard"] as const) for (const count of [2, 8, 90, 200]) for (let seed = 0; seed < 12; seed++) {
  const people = Array.from({ length: count }, (_, i) => ({ id: `weather-${i}`, name: `Prueba ${i}`, color: "#fff" }));
  const race = prepareMarbleRace(people, "direct", `weather-${seed}`, difficulty);
  const repeated = prepareMarbleRace(people, "direct", `weather-${seed}`, difficulty);
  assert.deepEqual(race.track.events, repeated.track.events);
  const end = Math.min(...race.racers.map(racer => racer.durationMs));
  let previousEnd = 0;
  for (const event of race.track.events) {
    assert.ok(event.startsAtMs! > previousEnd, "Los fenómenos no se superponen.");
    assert.ok(event.durationMs! > 1_400 && event.startsAtMs! + event.durationMs! < end * 0.9);
    assert.equal(marbleWeatherEnvelope(event, event.startsAtMs! - 1), 0);
    assert.equal(marbleWeatherEnvelope(event, event.startsAtMs! + event.durationMs!), 0);
    const peak = event.startsAtMs! + event.durationMs! / 2;
    assert.ok(marbleWeatherEnvelope(event, peak) > 0.99);
    assert.equal(activeMarbleWeather(race.track.events, peak)?.id, event.id);
    for (const racer of [race.racers[0], race.racers[count - 1]]) {
      const motion = getMarbleMotion(racer, race.track, peak);
      assert.equal(motion.activeTrackEvent, event.type, "El fenómeno afecta a canicas en diferentes posiciones al mismo tiempo.");
      assert.ok(motion.trackEventIntensity > 0.5);
    }
    const speedAtPeak = marbleWeatherTime(race.track.events, (peak + 1) / end, end) - marbleWeatherTime(race.track.events, (peak - 1) / end, end);
    const baselineSpeed = marbleWeatherTime(race.track.events, 1 / end, end) - marbleWeatherTime(race.track.events, 0, end);
    assert.ok(speedAtPeak / 2 < baselineSpeed * 0.85, "Debe cambiar el avance, no solo el decorado.");
    previousEnd = event.startsAtMs! + event.durationMs!;
  }
  assert.equal(activeMarbleWeather(race.track.events, 0), null);
  assert.equal(activeMarbleWeather(race.track.events, end), null);
  let previous = 0;
  for (let i = 0; i <= 400; i++) {
    const time = marbleWeatherTime(race.track.events, i / 400, end);
    assert.ok(Number.isFinite(time) && time >= previous && time <= 1);
    previous = time; samples++;
  }
  for (const racer of race.racers) {
    assert.equal(getMarbleMotion(racer, race.track, racer.durationMs).progress, 1);
    assert.equal(getMarbleMotion(racer, race.track, racer.durationMs - 1).finished, false);
  }
  const other = prepareMarbleRace(people, "direct", `different-${seed}`, difficulty);
  assert.notDeepEqual(race.track.events.map(e => e.startsAtMs), other.track.events.map(e => e.startsAtMs));
  schedules++;
}
console.log(JSON.stringify({ temporalWeatherSchedules: schedules, continuousTimeSamples: samples, affectsAllPositions: true, randomTimings: true, frameIndependent: true, committedArrivalTimesPreserved: true }));
