import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { DrawMode, MarbleDifficulty, MarbleFinishRule } from "../src/core/types.ts";
import { prepareMarbleRace } from "../src/games/marbles/marbleRaceEngine.ts";
interface Snapshot {
  count: number; seed: string; difficulty: MarbleDifficulty; mode: DrawMode; finishRule: MarbleFinishRule;
  selectedId: string; selectedNumber: number; durationMs: number; arrivalHash: string;
}
const fixture = JSON.parse(readFileSync(new URL("./fixtures/marble-races-v1.0.9.json", import.meta.url), "utf8")) as { revision: string; snapshots: Snapshot[] };
assert.equal(fixture.revision, "196e3b59d65ca4fe86e14ab39e5998ca4c16632a");
assert.equal(fixture.snapshots.length, 240);
for (const previous of fixture.snapshots) {
  const participants = Array.from({ length: previous.count }, (_, i) => ({ id: `legacy-${i}`, name: `Prueba ${i}`, color: "#09e0df" }));
  const current = prepareMarbleRace(participants, previous.mode, previous.seed, previous.difficulty, new Set(), previous.finishRule);
  const arrivalHash = createHash("sha256").update(JSON.stringify(current.racers.map(racer => [racer.id, racer.durationMs, racer.power, racer.powerTargetId, racer.incomingPower]))).digest("hex");
  assert.deepEqual([current.selected.id, current.selected.number, current.selected.durationMs, arrivalHash], [previous.selectedId, previous.selectedNumber, previous.durationMs, previous.arrivalHash], `La nueva geometría cambió una ronda comprometida en 1.0.9: ${previous.seed}/${previous.difficulty}/${previous.mode}/${previous.finishRule}.`);
}
console.log(JSON.stringify({ previousVersion: "1.0.9", immutableFixtures: fixture.snapshots.length, committedResultsPreserved: true }));
