import assert from "node:assert/strict";
import type { Participant, RoundResult, WinnerRecord } from "../src/core/types.ts";

const persistedItems = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => persistedItems.get(key) ?? null,
    setItem: (key: string, value: string) => persistedItems.set(key, value),
    removeItem: (key: string) => persistedItems.delete(key),
    clear: () => persistedItems.clear(),
    key: (index: number) => Array.from(persistedItems.keys())[index] ?? null,
    get length() { return persistedItems.size; },
  },
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  configurable: true,
});
persistedItems.set("fortuna-real-draw-v2", JSON.stringify({
  state: {
    participants: [],
    winnerRecords: { corrupt: true },
    history: "corrupt",
    activeSession: { status: "committed" },
  },
  version: 3,
}));

const {
  DRAW_STATE_VERSION,
  MAX_PARTICIPANTS,
  mergePersistedDrawState,
  migratePersistedDrawState,
  normalizeParticipantName,
  useDrawStore,
} = await import("../src/modules/participants/drawStore.ts");

const now = "2026-08-16T12:00:00.000Z";
const participant = (id: string, name: string): Participant => ({
  id,
  name,
  color: "#14d9d5",
});
const winner = (person: Participant): WinnerRecord => ({
  id: `winner-${person.id}`,
  participantId: person.id,
  participantName: person.name,
  prize: "Premio",
  mode: "direct",
  game: "roulette",
  createdAt: now,
});
const result = (person: Participant): RoundResult => ({
  id: `result-${person.id}`,
  participantId: person.id,
  participantName: person.name,
  kind: "eliminated",
  landedNumber: 1,
  parity: "odd",
  mode: "elimination",
  game: "roulette",
  round: 1,
  remainingCount: 1,
  eligibleCount: 1,
  createdAt: now,
});

const initial = useDrawStore.getInitialState();
assert.deepEqual(useDrawStore.getState().winnerRecords, []);
assert.deepEqual(useDrawStore.getState().history, []);
assert.equal(useDrawStore.getState().activeSession, null);

const corrupt = mergePersistedDrawState({
  participants: "not-an-array",
  winnerRecords: {},
  history: { broken: true },
  blockedWinnerIds: "all",
  roundNumber: Number.NaN,
  activeSession: { status: "committed" },
  addNames: "malicious override",
}, initial);
assert.deepEqual(corrupt.participants, initial.participants);
assert.deepEqual(corrupt.winnerRecords, initial.winnerRecords);
assert.deepEqual(corrupt.history, initial.history);
assert.equal(corrupt.roundNumber, 1);
assert.equal(corrupt.activeSession, null);
assert.equal(typeof corrupt.addNames, "function");

const ana = participant("p-ana", "Ana");
const legacy = migratePersistedDrawState({
  participants: [ana],
  winnerRecords: [winner(ana)],
}, 0);
const migrated = mergePersistedDrawState(legacy, initial);
assert.equal(migrated.participants.length, 1);
assert.equal(migrated.winnerRecords.length, 1);
assert.deepEqual(migrated.eliminatedIds, []);
assert.deepEqual(migrated.history, []);
assert.equal(migrated.activeSession, null);
assert.deepEqual(migratePersistedDrawState({ participants: [ana] }, DRAW_STATE_VERSION + 1), {});

const persistedSession = mergePersistedDrawState({
  participants: [ana],
  eliminatedIds: [ana.id, "unknown"],
  history: [result(ana)],
  roundNumber: 2,
  eliminationParity: "odd",
  activeSession: {
    sessionId: "session-1",
    status: "committed",
    game: "roulette",
    mode: "elimination",
    participantIds: [ana.id],
    roundCommitment: {
      roundNumber: 2,
      commitmentId: "round-hash",
      seed: "round-seed",
      committedAt: now,
    },
    startedAt: now,
  },
}, initial);
assert.deepEqual(persistedSession.eliminatedIds, [ana.id]);
assert.equal(persistedSession.history.length, 1);
assert.equal(persistedSession.roundNumber, 2);
assert.equal(persistedSession.eliminationParity, "odd");
assert.equal(persistedSession.activeSession?.roundCommitment?.commitmentId, "round-hash");

const resetStore = () => useDrawStore.setState({
  participants: [],
  eliminatedIds: [],
  history: [],
  winnerRecords: [],
  blockedWinnerIds: [],
  eliminationParity: null,
  mode: "elimination",
  game: "roulette",
  marbleDifficulty: "medium",
  pinballControlMode: "automatic",
  prize: "Premio del sorteo",
  roundNumber: 1,
  activeSession: null,
  sessionAudit: [],
  roundAudits: [],
});

resetStore();
const capacity = useDrawStore.getState().addNames(
  Array.from({ length: MAX_PARTICIPANTS + 2 }, (_, index) => `Persona ${index + 1}`),
);
assert.deepEqual(capacity, { added: MAX_PARTICIPANTS, skipped: 0, rejectedCapacity: 2 });
assert.equal(useDrawStore.getState().participants.length, MAX_PARTICIPANTS);

resetStore();
const prefix = "A".repeat(42);
const truncatedDuplicates = useDrawStore.getState().addNames([`${prefix}X`, `${prefix}Y`]);
assert.deepEqual(truncatedDuplicates, { added: 1, skipped: 1, rejectedCapacity: 0 });
assert.equal(useDrawStore.getState().participants[0].name, prefix);
assert.equal(normalizeParticipantName("  Jose\u0301   Perez  "), "José Perez");
const unicodeDuplicates = useDrawStore.getState().addNames(["Jose\u0301 Perez", "José Perez"]);
assert.deepEqual(unicodeDuplicates, { added: 1, skipped: 1, rejectedCapacity: 0 });

resetStore();
useDrawStore.setState({
  participants: [ana],
  winnerRecords: [winner(ana)],
  blockedWinnerIds: [ana.id],
});
useDrawStore.getState().removeParticipant(ana.id);
assert.equal(useDrawStore.getState().winnerRecords.length, 1);
assert.deepEqual(useDrawStore.getState().blockedWinnerIds, []);
useDrawStore.setState({ participants: [ana] });
useDrawStore.getState().clearParticipants();
assert.equal(useDrawStore.getState().winnerRecords.length, 1);

resetStore();
useDrawStore.setState({ participants: [ana] });
const session = useDrawStore.getState().beginSession({
  seed: "session-seed",
  commitmentId: "session-hash",
});
assert.deepEqual(session.participantIds, [ana.id]);
assert.throws(() => useDrawStore.getState().setPrize("Otro premio"), /Cancela la sesión/);
assert.throws(() => useDrawStore.getState().cancelSession("  "), /motivo/);
const round = useDrawStore.getState().commitRound({
  commitmentId: "round-hash",
  seed: "round-seed",
});
assert.equal(round.roundNumber, 1);
assert.throws(
  () => useDrawStore.getState().commitRound({ commitmentId: "replacement" }),
  /pendiente/,
);
const cancellation = useDrawStore.getState().cancelSession("Operador solicitó reinicio");
assert.equal(cancellation.roundCommitment?.commitmentId, "round-hash");
assert.equal(useDrawStore.getState().activeSession, null);
assert.equal(useDrawStore.getState().sessionAudit[0].reason, "Operador solicitó reinicio");
assert.deepEqual(useDrawStore.getState().sessionAudit[0].participantIds, [ana.id]);

resetStore();
const bea = { id: "bea", name: "Bea", color: "#e7a61a" };
useDrawStore.setState({ participants: [ana, bea], mode: "direct", game: "cards" });
useDrawStore.getState().beginSession();
useDrawStore.getState().commitRound({
  commitmentId: "CARD-TEST-SHA256",
  seed: "round-seed-256",
  expectedParticipantId: ana.id,
});
assert.throws(() => useDrawStore.getState().reenableWinner(ana.id), /Cancela la sesión/);
assert.throws(
  () => useDrawStore.getState().recordSelection(bea.id, 2, "Carta oculta 2"),
  /no coincide con el compromiso/,
);
const auditedResult = useDrawStore.getState().recordSelection(ana.id, 1, "Carta oculta 1");
assert.equal(auditedResult.commitmentId, "CARD-TEST-SHA256");
assert.equal(auditedResult.revealedSeed, "round-seed-256");
assert.match(auditedResult.auditHash ?? "", /^[0-9a-f]{64}$/u);
assert.equal(useDrawStore.getState().roundAudits.length, 1);
assert.equal(useDrawStore.getState().roundAudits[0].selectedParticipantId, ana.id);

console.log(JSON.stringify({
  persistenceVersion: DRAW_STATE_VERSION,
  corruptStateRecovery: true,
  legacyMigration: true,
  activeSessionRecovery: true,
  capacityLimit: MAX_PARTICIPANTS,
  normalizedDedupe: true,
  winnerHistorySeparated: true,
  cancellationAudit: true,
  roundCommitmentRecovery: true,
  committedRosterLocked: true,
  completedRoundAudit: true,
}));
