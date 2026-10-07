import assert from "node:assert/strict";
import type { GameId, Participant, RoundResult } from "../src/core/types.ts";
import { readFileSync } from "node:fs";
import { buildFinalStandings, sanitizeStandings } from "../src/modules/results/resultStandings.ts";
import { completedArchive, groupResultArchive, publishedWinners } from "../src/modules/results/resultArchive.ts";
import { prepareMarbleRace } from "../src/games/marbles/marbleRaceEngine.ts";
import { createMarbleStandings } from "../src/games/marbles/marbleStandings.ts";

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
const { useDrawStore, mergePersistedDrawState } = await import("../src/modules/participants/drawStore.ts");
const initial = useDrawStore.getInitialState();
const serializable = (value: unknown) => JSON.parse(JSON.stringify(value));
const roster = (n: number): Participant[] => Array.from({ length: n }, (_, i) => ({ id: `p-${i}`, name: `Persona ${i + 1}`, color: "#14d9d5" }));
const start = (game: GameId, count: number, mode: "direct" | "elimination" = "elimination") => {
  useDrawStore.setState({ ...initial, game, mode, participants: roster(count), prize: "Premio verificado" });
  return useDrawStore.getState().beginSession();
};
const commit = (id: string) => useDrawStore.getState().commitRound({ commitmentId: `test-${crypto.randomUUID()}`, expectedParticipantId: id });
const games: GameId[] = ["roulette", "cards", "marbles", "pinball", "ducks"];
let completeMatches = 0;
for (const game of games) {
  start(game, 8);
  const pending = useDrawStore.getState();
  assert.throws(() => pending.completeSession(), /ganador/);
  commit("p-0");
  if (game !== "ducks") pending.recordSelection("p-0", 1);
  assert.equal(useDrawStore.getState().resultArchive.length, 0, "Las rondas parciales no se publican.");
  const cancelled = useDrawStore.getState().cancelSession("Prueba de aborto");
  assert.equal(useDrawStore.getState().history.length, 0);
  assert.equal(useDrawStore.getState().resultArchive.length, 0);
  assert.equal(useDrawStore.getState().winnerRecords.length, 0);
  assert.equal(useDrawStore.getState().sessionAudit[0].sessionId, cancelled.sessionId, "La auditoría de cancelación no se borra.");
  assert.throws(() => pending.recordSelection("p-0", 1), /comprometida/);

  for (const count of [2, 8, 200]) {
    const session = start(game, count);
    if (game === "ducks") {
      commit(`p-${count - 1}`);
      useDrawStore.getState().recordDuckSurvival(`p-${count - 1}`, roster(count - 1).map((person, index) => ({ participantId: person.id, number: index + 1 })));
    } else {
      for (let i = 0; i < count - 1; i++) {
        commit(`p-${i}`);
        useDrawStore.getState().recordSelection(`p-${i}`, i + 1);
        if (i < count - 2) assert.equal(useDrawStore.getState().resultArchive.length, 0);
      }
    }
    const state = useDrawStore.getState();
    const matches = groupResultArchive(state.resultArchive);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, session.sessionId);
    assert.equal(state.winnerRecords[0].sessionId, session.sessionId);
    const rows = matches[0].winner!.standings!;
    assert.equal(rows.length, count);
    assert.deepEqual(rows.map(row => row.participantId), roster(count).reverse().map(person => person.id));
    assert.deepEqual(rows.map(row => row.position), roster(count).map((_, i) => i + 1));
    assert.equal(publishedWinners(state.winnerRecords, state.resultArchive, state.sessionAudit).length, 1);
    assert.throws(() => state.cancelSession("No se puede abortar una partida terminada"), /activa/);
    const reloaded = mergePersistedDrawState(JSON.parse(storage.get("fortuna-real-draw-v2")!).state, initial);
    assert.deepEqual(serializable(groupResultArchive(reloaded.resultArchive)[0].winner!.standings), serializable(rows));
    state.clearParticipants();
    assert.deepEqual(groupResultArchive(useDrawStore.getState().resultArchive)[0].winner!.standings, rows, "Borrar participantes no cambia la fotografía histórica.");
    completeMatches++;
  }
}

for (const game of ["roulette", "cards", "pinball"] as const) {
  start(game, 8, "direct"); commit("p-3");
  const result = useDrawStore.getState().recordSelection("p-3", 4);
  assert.equal(result.standings!.length, 8);
  assert.equal(result.standings![0].participantId, "p-3");
  assert.ok(result.standings!.slice(1).every(row => row.position === null && row.outcome === "not-selected"), "Un sorteo directo no inventa segundo y tercer puesto.");
}

for (const finishRule of ["first", "last"] as const) {
  start("marbles", 200, "direct");
  const race = prepareMarbleRace(roster(200), "direct", "archive-camera", "medium", new Set(), finishRule);
  const snapshot = createMarbleStandings(race, race.selected.durationMs).map(item => ({ participantId: item.racer.participant.id, position: item.position }));
  commit(race.selected.participant.id);
  const result = useDrawStore.getState().recordSelection(race.selected.participant.id, race.selected.number, "Llegada", snapshot);
  assert.equal(result.standings!.length, 200);
  assert.equal(result.standings!.find(row => row.outcome === "winner")!.position, finishRule === "first" ? 1 : 200);
}

const valid = buildFinalStandings(roster(2), "p-1", "elimination", ["p-0"], []);
assert.deepEqual(serializable(sanitizeStandings(valid)), serializable(valid));
for (const value of [null, [{ ...valid[0], position: -1 }], [...valid, valid[0]], [{ ...valid[0], position: null }], valid.map(row => ({ ...row, position: 1 })), [{ ...valid[0], participantName: "X".repeat(50) }]]) {
  assert.equal(sanitizeStandings(value), undefined);
}
assert.throws(() => buildFinalStandings(roster(2), "p-0", "direct", [], [], [{ participantId: "p-0", position: 1 }]), /exactamente/);
assert.throws(() => buildFinalStandings(roster(2), "p-0", "elimination", [], []), /Faltan/);

const finalState = useDrawStore.getState();
const cancelledId = finalState.resultArchive[0].sessionId!;
assert.equal(groupResultArchive(finalState.resultArchive, new Set([cancelledId])).length, 0);
assert.equal(publishedWinners(finalState.winnerRecords, finalState.resultArchive, [{ sessionId: cancelledId }]).length, 0);
assert.equal(publishedWinners(finalState.winnerRecords, [], []).length, 0);
const legacyWinner: RoundResult = { ...finalState.resultArchive[0], sessionId: undefined, standings: undefined };
assert.equal(completedArchive([legacyWinner]).length, 1);
assert.equal(completedArchive([{ ...legacyWinner, kind: "eliminated" }]).length, 0);
const cancelledMigration = mergePersistedDrawState({ ...finalState, sessionAudit: [{ sessionId: cancelledId, status: "cancelled", game: "marbles", mode: "direct", participantIds: roster(200).map(row => row.id), startedAt: new Date().toISOString(), cancelledAt: new Date().toISOString(), reason: "Prueba de registro antiguo" }] }, initial);
assert.equal(cancelledMigration.resultArchive.length, 0);
assert.equal(cancelledMigration.winnerRecords.length, 0);

const retiredSelection = mergePersistedDrawState({ ...initial, game: "pinball", setupGameChosen: true }, initial);
assert.equal(retiredSelection.game, "roulette");
assert.equal(retiredSelection.setupGameChosen, false);

const credit = readFileSync("src/shared/project.ts", "utf8");
const permissions = JSON.parse(readFileSync("src-tauri/capabilities/default.json", "utf8"));
assert.ok(credit.includes('"OscarD0823"') && credit.includes('"https://github.com/OscarD0823/Fortuna-Real"'));
assert.deepEqual(permissions.permissions.find((entry: { identifier?: string }) => entry.identifier === "opener:allow-open-url").allow, [{ url: "https://github.com/OscarD0823/Fortuna-Real" }, { url: "https://oscard0823.github.io/Fortuna-Real/" }]);
assert.ok(readFileSync("src/App.tsx", "utf8").includes("<AuthorCard />"));
const appCss = readFileSync("src/App.css", "utf8");
assert.ok(appCss.includes(".results-open { display: flex;"), "El acceso al historial debe seguir visible en ventanas estrechas.");
assert.ok(readFileSync("src/modules/results/ResultsArchive.tsx", "utf8").includes('format: "fortuna-results-v2"'));
console.log(JSON.stringify({ completedMatches: completeMatches, games, counts: [2, 8, 200], fullStandingsPersisted: true, cancelledMatchesExcluded: true, cancellationAuditPreserved: true, directNonWinnersUnranked: true, marbleFirstAndLast: true, authorCreditScoped: true, status: "passed" }));
