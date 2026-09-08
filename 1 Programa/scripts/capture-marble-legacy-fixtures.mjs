// Maintenance only: regenerate fixtures from the immutable published 1.0.9 code.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
const revision = "196e3b59d65ca4fe86e14ab39e5998ca4c16632a";
const source = execFileSync("git", ["show", `${revision}:1 Programa/src/games/marbles/marbleRaceEngine.ts`], { encoding: "utf8", maxBuffer: 1_000_000, windowsHide: true });
const legacy = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const snapshots = [];
for (const count of [2, 8, 32, 90, 200]) for (const difficulty of ["easy", "medium", "hard"]) for (const mode of ["direct", "elimination"]) for (const finishRule of ["first", "last"]) for (let index = 0; index < 4; index += 1) {
  const seed = `legacy-1.0.9-${count}-${index}`;
  const participants = Array.from({ length: count }, (_, i) => ({ id: `legacy-${i}`, name: `Prueba ${i}`, color: "#09e0df" }));
  const race = legacy.prepareMarbleRace(participants, mode, seed, difficulty, new Set(), finishRule);
  const arrivalHash = createHash("sha256").update(JSON.stringify(race.racers.map(racer => [racer.id, racer.durationMs, racer.power, racer.powerTargetId, racer.incomingPower]))).digest("hex");
  snapshots.push({ count, seed, difficulty, mode, finishRule, selectedId: race.selected.id, selectedNumber: race.selected.number, durationMs: race.selected.durationMs, arrivalHash });
}
mkdirSync(new URL("./fixtures/", import.meta.url), { recursive: true });
writeFileSync(new URL("./fixtures/marble-races-v1.0.9.json", import.meta.url), `${JSON.stringify({ revision, snapshots }, null, 2)}\n`, "utf8");
console.log(`Captured ${snapshots.length} race contracts from published ${revision}.`);
