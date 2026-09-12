import assert from "node:assert/strict";
import { createSealedDuckCommitmentFromSeed, duckStartingLivesFromSeed } from "../src/games/ducks/duckCommitment.ts";
import { hitDuckContestant, prepareDuckContestants } from "../src/games/ducks/duckHuntEngine.ts";

const entropy = "1234567890abcdef".repeat(4);
let officialHits = 0;
for (let count = 2; count <= 200; count++) {
  const people = Array.from({ length: count }, (_, i) => ({ id: `p-${i}`, name: `Participante ${i}`, color: "#fff" }));
  const seed = `quick1:${entropy}`;
  const order = await createSealedDuckCommitmentFromSeed(people.map(p => p.id), seed);
  assert.equal(order.hitOrder.length, count - 1);
  assert.deepEqual(order.hitOrder, order.eliminationOrder);
  assert.deepEqual(order, await createSealedDuckCommitmentFromSeed(people.map(p => p.id), seed));
  const legacy = await createSealedDuckCommitmentFromSeed(people.map(p => p.id), entropy);
  assert.equal(legacy.hitOrder.length, (count - 1) * 3);
  assert.equal(order.survivorId, legacy.survivorId, "Una vida cambia la duración, no la selección uniforme.");
  assert.notEqual(order.commitmentId, legacy.commitmentId, "La regla debe quedar incluida en el sello.");
  let ducks = prepareDuckContestants(people, "quick-visual", new Set(), duckStartingLivesFromSeed(seed));
  assert.ok(ducks.every(duck => duck.lives === 1 && duck.speed > 1));
  for (const id of order.hitOrder) {
    const result = hitDuckContestant(ducks, id);
    assert.ok(result?.knockedOut);
    ducks = result.contestants;
    assert.equal(result.target.lives, 0); officialHits++;
  }
  assert.deepEqual(ducks.filter(duck => !duck.knockedOut).map(duck => duck.id), [order.survivorId]);
  assert.equal(duckStartingLivesFromSeed(entropy), 3);
}
console.log(JSON.stringify({ quickOneLife: true, testedSizes: "2..200", officialHits, oldThreeLifeCommitmentsPreserved: true, sameUniformSurvivor: true }));
