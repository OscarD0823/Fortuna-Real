import {
  DUCK_STARTING_LIVES,
  getDuckSpeed,
  hitDuckContestant,
  learnFromDuckShot,
  prepareDuckNextFlight,
  prepareDuckContestants,
} from "../src/games/ducks/duckHuntEngine.ts";
import type { Participant } from "../src/core/types.ts";

const makeParticipants = (count: number): Participant[] => Array.from({ length: count }, (_, index) => ({
  id: `duck-player-${index + 1}`,
  name: `Jugador ${index + 1}`,
  color: `hsl(${(index * 137.5) % 360}, 82%, 58%)`,
}));

const startedAt = performance.now();
let totalHits = 0;
let maximumLogicMs = 0;
let deterministicChecks = 0;

for (let count = 2; count <= 200; count += 1) {
  const participants = makeParticipants(count);
  const seed = `duck-capacity-${count}`;
  let contestants = prepareDuckContestants(participants, seed);
  const repeated = prepareDuckContestants(participants, seed);
  if (JSON.stringify(contestants.map((contestant) => contestant.profile)) !== JSON.stringify(repeated.map((contestant) => contestant.profile))) {
    throw new Error(`La formación de ${count} patos no es determinista.`);
  }
  deterministicChecks += 1;
  if (contestants.some((contestant) => contestant.lives !== DUCK_STARTING_LIVES || contestant.knockedOut)) {
    throw new Error(`Estado inicial inválido para ${count} patos.`);
  }

  const survivorId = contestants[count - 1].id;
  const logicStartedAt = performance.now();
  for (const participant of participants.slice(0, -1)) {
    for (let life = DUCK_STARTING_LIVES; life > 0; life -= 1) {
      const result = hitDuckContestant(contestants, participant.id);
      if (!result) throw new Error(`No se pudo impactar a ${participant.id} con ${count} patos.`);
      contestants = result.contestants;
      totalHits += 1;
      if (result.target.lives !== life - 1) throw new Error("El impacto no restó exactamente una vida.");
      if (result.target.speed !== getDuckSpeed(result.target.lives)) throw new Error("La velocidad no corresponde a las vidas restantes.");
      if (life > 1 && result.survivor) throw new Error("Se declaró un ganador antes de tiempo.");
    }
    if (hitDuckContestant(contestants, participant.id) !== null) throw new Error("Un pato eliminado recibió un impacto adicional.");
  }
  maximumLogicMs = Math.max(maximumLogicMs, performance.now() - logicStartedAt);
  const living = contestants.filter((contestant) => !contestant.knockedOut);
  if (living.length !== 1 || living[0].id !== survivorId) {
    throw new Error(`La simulación de ${count} patos no terminó con el superviviente esperado.`);
  }
}

const adaptiveParticipants = makeParticipants(4);
const adaptivePrepared = prepareDuckContestants(
  adaptiveParticipants,
  "adaptive-check",
  new Set([adaptiveParticipants[0].id]),
);
if (!adaptivePrepared[0].previousWinner || adaptivePrepared.slice(1).some((contestant) => contestant.previousWinner)) {
  throw new Error("La corona de ganador anterior no se asignó correctamente.");
}
const learnedFlock = learnFromDuckShot(adaptivePrepared, 0.35, -0.22, adaptivePrepared[1].id);
if (!learnedFlock[1].grazed || learnedFlock.some((contestant) => contestant.threatLevel <= 0)) {
  throw new Error("La bandada no aprendió correctamente del disparo o del roce.");
}
const nextFlight = prepareDuckNextFlight(learnedFlock);
if (nextFlight[1].grazed || nextFlight.some((contestant) => contestant.routeSeed < 0 || contestant.routeSeed >= 1)) {
  throw new Error("La siguiente ruta no renovó su entropía o conservó un roce antiguo.");
}
const shieldTarget = { ...nextFlight[1], shielded: true };
const shieldTest = hitDuckContestant(
  nextFlight.map((contestant) => contestant.id === shieldTarget.id ? shieldTarget : contestant),
  shieldTarget.id,
);
if (!shieldTest?.shieldAbsorbed || shieldTest.target.lives !== shieldTarget.lives || shieldTest.target.shielded) {
  throw new Error("El blindaje no absorbió exactamente un impacto.");
}

const memoryStorage = new Map<string, string>();
const testStorage = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => memoryStorage.set(key, value),
  removeItem: (key: string) => memoryStorage.delete(key),
  clear: () => memoryStorage.clear(),
  key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
  get length() { return memoryStorage.size; },
};
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: testStorage,
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage: testStorage },
});
const { useDrawStore } = await import("../src/modules/participants/drawStore.ts");
useDrawStore.getState().clearParticipants();
useDrawStore.getState().addNames(["Ana", "Luis", "Mateo", "Sofía"]);
useDrawStore.getState().setGame("ducks");
useDrawStore.getState().setMode("elimination");
useDrawStore.getState().setPrize("Premio de prueba");
const storeParticipants = useDrawStore.getState().participants;
const storeWinner = useDrawStore.getState().recordDuckSurvival(
  storeParticipants[3].id,
  storeParticipants.slice(0, 3).map((participant, index) => ({ participantId: participant.id, number: index + 1 })),
);
const storedState = useDrawStore.getState();
if (storeWinner.kind !== "winner" || storeWinner.game !== "ducks" || storedState.history.length !== 4) {
  throw new Error("El resultado de supervivencia no se integró correctamente con el historial.");
}
if (storedState.winnerRecords[0]?.participantId !== storeParticipants[3].id || storedState.winnerRecords[0]?.prize !== "Premio de prueba") {
  throw new Error("El ganador de Patos 3D no conservó su premio.");
}
if (!storedState.blockedWinnerIds.includes(storeParticipants[3].id) || storedState.eliminatedIds.length !== 3) {
  throw new Error("El bloqueo del ganador o las eliminaciones de Patos 3D son incorrectos.");
}

console.log(JSON.stringify({
  participantCounts: "2..200",
  countsTested: 199,
  deterministicChecks,
  totalHits,
  storeIntegration: "passed",
  adaptiveFlight: "passed",
  maximumLogicMs: Number(maximumLogicMs.toFixed(2)),
  totalMs: Number((performance.now() - startedAt).toFixed(2)),
}, null, 2));
