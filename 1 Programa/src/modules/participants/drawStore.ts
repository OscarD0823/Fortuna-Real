import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DrawMode,
  GameId,
  MarbleDifficulty,
  Participant,
  Parity,
  PinballControlMode,
  RoundResult,
  WinnerRecord,
} from "../../core/types";
import { canonicalJson, sha256Hex } from "../../shared/crypto/sha256.ts";

const PALETTE = [
  "#14d9d5",
  "#e7a61a",
  "#e34834",
  "#28bf77",
  "#138c98",
  "#f0bf45",
  "#d8342a",
  "#50cf87",
];

export const MAX_PARTICIPANTS = 200;
export const MAX_PARTICIPANT_NAME_LENGTH = 42;
export const DRAW_STATE_VERSION = 4;
const MAX_PRIZE_LENGTH = 60;
const MAX_HISTORY_RECORDS = 1_000;
const MAX_WINNER_RECORDS = 1_000;
const MAX_SESSION_AUDIT_RECORDS = 100;
const MAX_ROUND_AUDIT_RECORDS = 200;
const MAX_ID_LENGTH = 128;
const MAX_CANCELLATION_REASON_LENGTH = 160;

const makeId = () => {
  if (typeof crypto === "undefined" || !("randomUUID" in crypto)) {
    throw new Error("Este equipo no ofrece identificadores criptográficos seguros.");
  }
  return crypto.randomUUID();
};

const makeParticipant = (name: string, index: number): Participant => ({
  id: makeId(),
  name,
  color: PALETTE[index % PALETTE.length],
});

const normalizeDrawMode = (mode: unknown): DrawMode =>
  mode === "direct" ? "direct" : "elimination";

const normalizeGame = (game: unknown): GameId =>
  game === "cards" || game === "pinball" || game === "marbles" || game === "ducks"
    ? game
    : "roulette";

const normalizePinballControlMode = (mode: unknown): PinballControlMode =>
  mode === "manual" ? "manual" : "automatic";

const normalizeMarbleDifficulty = (difficulty: unknown): MarbleDifficulty =>
  difficulty === "easy" || difficulty === "hard" ? difficulty : "medium";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const truncateText = (value: string, maxLength: number) =>
  Array.from(value).slice(0, maxLength).join("");

export const normalizeParticipantName = (value: unknown) => {
  if (typeof value !== "string") return "";
  return truncateText(
    value.normalize("NFKC").trim().replace(/\s+/gu, " "),
    MAX_PARTICIPANT_NAME_LENGTH,
  ).trim();
};

const participantNameKey = (name: string) =>
  normalizeParticipantName(name).toLocaleLowerCase("es-CO");

const sanitizeId = (value: unknown) => {
  if (typeof value !== "string") return null;
  const id = truncateText(value.trim(), MAX_ID_LENGTH);
  return id.length > 0 ? id : null;
};

const sanitizeDate = (value: unknown) =>
  typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;

const sanitizeOptionalText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? truncateText(value.trim(), maxLength) || undefined : undefined;

const sanitizeInteger = (value: unknown, minimum: number, maximum: number) =>
  typeof value === "number" && Number.isInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : null;

const sanitizeParticipants = (value: unknown): Participant[] => {
  if (!Array.isArray(value)) return [];
  const participants: Participant[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const candidate of value) {
    if (participants.length >= MAX_PARTICIPANTS) break;
    if (!isRecord(candidate)) continue;
    const id = sanitizeId(candidate.id);
    const name = normalizeParticipantName(candidate.name);
    const nameKey = participantNameKey(name);
    if (!id || !name || ids.has(id) || names.has(nameKey)) continue;
    const color =
      typeof candidate.color === "string" && /^#[0-9a-f]{6}$/iu.test(candidate.color)
        ? candidate.color
        : PALETTE[participants.length % PALETTE.length];
    ids.add(id);
    names.add(nameKey);
    participants.push({ id, name, color });
  }

  return participants;
};

const sanitizeWinnerRecords = (value: unknown): WinnerRecord[] => {
  if (!Array.isArray(value)) return [];
  const records: WinnerRecord[] = [];
  const ids = new Set<string>();

  for (const candidate of value) {
    if (records.length >= MAX_WINNER_RECORDS) break;
    if (!isRecord(candidate)) continue;
    const id = sanitizeId(candidate.id);
    const participantId = sanitizeId(candidate.participantId);
    const participantName = normalizeParticipantName(candidate.participantName);
    const createdAt = sanitizeDate(candidate.createdAt);
    if (!id || !participantId || !participantName || !createdAt || ids.has(id)) continue;
    ids.add(id);
    records.push({
      id,
      participantId,
      participantName,
      prize:
        sanitizeOptionalText(candidate.prize, MAX_PRIZE_LENGTH) ?? "Premio del sorteo",
      mode: normalizeDrawMode(candidate.mode),
      game: normalizeGame(candidate.game),
      createdAt,
    });
  }

  return records;
};

const ROUND_RESULT_KINDS: RoundResult["kind"][] = [
  "winner",
  "eliminated",
  "qualified",
  "parity-selected",
];

const sanitizeHistory = (value: unknown): RoundResult[] => {
  if (!Array.isArray(value)) return [];
  const history: RoundResult[] = [];
  const ids = new Set<string>();

  for (const candidate of value) {
    if (history.length >= MAX_HISTORY_RECORDS) break;
    if (!isRecord(candidate)) continue;
    const id = sanitizeId(candidate.id);
    const participantId = candidate.participantId === null
      ? null
      : sanitizeId(candidate.participantId);
    const participantName = normalizeParticipantName(candidate.participantName);
    const createdAt = sanitizeDate(candidate.createdAt);
    const kind = ROUND_RESULT_KINDS.includes(candidate.kind as RoundResult["kind"])
      ? candidate.kind as RoundResult["kind"]
      : null;
    const landedNumber = sanitizeInteger(candidate.landedNumber, 0, 1_000_000);
    const round = sanitizeInteger(candidate.round, 1, 10_000);
    const remainingCount = sanitizeInteger(candidate.remainingCount, 0, MAX_PARTICIPANTS);
    const eligibleCount = sanitizeInteger(candidate.eligibleCount, 0, MAX_PARTICIPANTS);
    if (
      !id || !participantName || !createdAt || !kind || ids.has(id)
      || landedNumber === null || round === null
      || remainingCount === null || eligibleCount === null
      || (candidate.participantId !== null && participantId === null)
    ) continue;
    ids.add(id);
    history.push({
      id,
      participantId,
      participantName,
      selectedParticipantName: sanitizeOptionalText(
        candidate.selectedParticipantName,
        MAX_PARTICIPANT_NAME_LENGTH,
      ),
      selectionLabel: sanitizeOptionalText(candidate.selectionLabel, 100),
      kind,
      landedNumber,
      parity: candidate.parity === "even" ? "even" : "odd",
      mode: normalizeDrawMode(candidate.mode),
      game: normalizeGame(candidate.game),
      prize: sanitizeOptionalText(candidate.prize, MAX_PRIZE_LENGTH),
      round,
      remainingCount,
      eligibleCount,
      createdAt,
      auditId: sanitizeOptionalText(candidate.auditId, MAX_ID_LENGTH),
      commitmentId: sanitizeOptionalText(candidate.commitmentId, MAX_ID_LENGTH),
      revealedSeed: sanitizeOptionalText(candidate.revealedSeed, MAX_ID_LENGTH),
      auditHash: sanitizeOptionalText(candidate.auditHash, MAX_ID_LENGTH),
    });
  }

  return history;
};

export interface AddNamesResult {
  added: number;
  skipped: number;
  rejectedCapacity: number;
}

export interface ActiveDrawSession {
  sessionId: string;
  status: "committed" | "completed";
  game: GameId;
  mode: DrawMode;
  seed?: string;
  commitmentId?: string;
  participantIds: string[];
  roundCommitment: ActiveRoundCommitment | null;
  startedAt: string;
  completedAt?: string;
}

export interface ActiveRoundCommitment {
  roundNumber: number;
  commitmentId: string;
  seed?: string;
  expectedParticipantId?: string;
  expectedLandedNumber?: number;
  committedAt: string;
}

export interface RoundAudit {
  auditId: string;
  previousAuditHash?: string;
  auditHash: string;
  sessionId: string;
  game: GameId;
  mode: DrawMode;
  roundNumber: number;
  participantIds: string[];
  commitmentId: string;
  revealedSeed?: string;
  selectedParticipantId: string;
  resultParticipantId: string | null;
  resultKind: RoundResult["kind"];
  landedNumber: number;
  committedAt: string;
  resolvedAt: string;
}

export interface DrawSessionCancellation {
  sessionId: string;
  status: "cancelled";
  game: GameId;
  mode: DrawMode;
  seed?: string;
  commitmentId?: string;
  participantIds: string[];
  roundCommitment: ActiveRoundCommitment | null;
  startedAt: string;
  cancelledAt: string;
  reason: string;
}

export interface BeginDrawSessionOptions {
  seed?: string;
  commitmentId?: string;
}

export interface CommitRoundOptions {
  commitmentId: string;
  seed?: string;
  expectedParticipantId?: string;
  expectedLandedNumber?: number;
}

export interface DrawState {
  participants: Participant[];
  eliminatedIds: string[];
  history: RoundResult[];
  winnerRecords: WinnerRecord[];
  blockedWinnerIds: string[];
  eliminationParity: Parity | null;
  mode: DrawMode;
  game: GameId;
  marbleDifficulty: MarbleDifficulty;
  pinballControlMode: PinballControlMode;
  prize: string;
  roundNumber: number;
  activeSession: ActiveDrawSession | null;
  sessionAudit: DrawSessionCancellation[];
  roundAudits: RoundAudit[];
  addNames: (names: string[]) => AddNamesResult;
  removeParticipant: (id: string) => void;
  clearParticipants: () => void;
  setMode: (mode: DrawMode) => void;
  setGame: (game: GameId) => void;
  setMarbleDifficulty: (difficulty: MarbleDifficulty) => void;
  setPinballControlMode: (mode: PinballControlMode) => void;
  setPrize: (prize: string) => void;
  beginSession: (options?: BeginDrawSessionOptions) => ActiveDrawSession;
  commitRound: (options: CommitRoundOptions) => ActiveRoundCommitment;
  clearRoundCommitment: () => void;
  completeSession: () => void;
  cancelSession: (reason: string) => DrawSessionCancellation;
  resumeSession: () => ActiveDrawSession | null;
  startDraw: () => void;
  recordSelection: (
    participantId: string,
    landedNumber: number,
    selectionLabel?: string,
  ) => RoundResult;
  recordParitySelection: (parity: Parity, landedNumber: number) => RoundResult;
  recordDuckSurvival: (
    survivorId: string,
    knockouts: Array<{ participantId: string; number: number }>,
  ) => RoundResult;
  reenableWinner: (participantId: string) => void;
  reenableAllWinners: () => void;
  clearWinnerHistory: () => void;
  resetDraw: () => void;
}

const sanitizeActiveSession = (value: unknown): ActiveDrawSession | null => {
  if (!isRecord(value)) return null;
  if (value.status !== "committed" && value.status !== "completed") return null;
  const sessionId = sanitizeId(value.sessionId);
  const startedAt = sanitizeDate(value.startedAt);
  const status = value.status;
  if (!sessionId || !startedAt) return null;
  const completedAt = status === "completed" ? sanitizeDate(value.completedAt) : null;
  const roundCommitment = status === "committed"
    ? sanitizeRoundCommitment(value.roundCommitment)
    : null;
  return {
    sessionId,
    status,
    game: normalizeGame(value.game),
    mode: normalizeDrawMode(value.mode),
    seed: sanitizeOptionalText(value.seed, MAX_ID_LENGTH),
    commitmentId: sanitizeOptionalText(value.commitmentId, MAX_ID_LENGTH),
    participantIds: Array.isArray(value.participantIds)
      ? Array.from(new Set(value.participantIds.flatMap((candidate) => {
          const id = sanitizeId(candidate);
          return id ? [id] : [];
        }))).slice(0, MAX_PARTICIPANTS)
      : [],
    roundCommitment,
    startedAt,
    completedAt: completedAt ?? undefined,
  };
};

const sanitizeRoundCommitment = (value: unknown): ActiveRoundCommitment | null => {
  if (!isRecord(value)) return null;
  const roundNumber = sanitizeInteger(value.roundNumber, 1, 10_000);
  const commitmentId = sanitizeOptionalText(value.commitmentId, MAX_ID_LENGTH);
  const committedAt = sanitizeDate(value.committedAt);
  if (roundNumber === null || !commitmentId || !committedAt) return null;
  return {
    roundNumber,
    commitmentId,
    seed: sanitizeOptionalText(value.seed, MAX_ID_LENGTH),
    expectedParticipantId: sanitizeOptionalText(value.expectedParticipantId, MAX_ID_LENGTH),
    expectedLandedNumber: sanitizeInteger(value.expectedLandedNumber, 0, 1_000_000) ?? undefined,
    committedAt,
  };
};

const sanitizeRoundAudits = (value: unknown): RoundAudit[] => {
  if (!Array.isArray(value)) return [];
  const audits: RoundAudit[] = [];
  for (const candidate of value) {
    if (audits.length >= MAX_ROUND_AUDIT_RECORDS) break;
    if (!isRecord(candidate)) continue;
    const auditId = sanitizeId(candidate.auditId);
    const auditHash = sanitizeOptionalText(candidate.auditHash, MAX_ID_LENGTH);
    const sessionId = sanitizeId(candidate.sessionId);
    const commitmentId = sanitizeOptionalText(candidate.commitmentId, MAX_ID_LENGTH);
    const selectedParticipantId = sanitizeId(candidate.selectedParticipantId);
    const resultParticipantId = candidate.resultParticipantId === null
      ? null
      : sanitizeId(candidate.resultParticipantId);
    const roundNumber = sanitizeInteger(candidate.roundNumber, 1, 10_000);
    const landedNumber = sanitizeInteger(candidate.landedNumber, 0, 1_000_000);
    const committedAt = sanitizeDate(candidate.committedAt);
    const resolvedAt = sanitizeDate(candidate.resolvedAt);
    const resultKind = ROUND_RESULT_KINDS.includes(candidate.resultKind as RoundResult["kind"])
      ? candidate.resultKind as RoundResult["kind"]
      : null;
    if (
      !auditId || !auditHash || !sessionId || !commitmentId || !selectedParticipantId
      || roundNumber === null || landedNumber === null || !committedAt || !resolvedAt || !resultKind
      || (candidate.resultParticipantId !== null && !resultParticipantId)
    ) continue;
    audits.push({
      auditId,
      previousAuditHash: sanitizeOptionalText(candidate.previousAuditHash, MAX_ID_LENGTH),
      auditHash,
      sessionId,
      game: normalizeGame(candidate.game),
      mode: normalizeDrawMode(candidate.mode),
      roundNumber,
      participantIds: Array.isArray(candidate.participantIds)
        ? Array.from(new Set(candidate.participantIds.flatMap((participantId) => {
            const id = sanitizeId(participantId);
            return id ? [id] : [];
          }))).slice(0, MAX_PARTICIPANTS)
        : [],
      commitmentId,
      revealedSeed: sanitizeOptionalText(candidate.revealedSeed, MAX_ID_LENGTH),
      selectedParticipantId,
      resultParticipantId,
      resultKind,
      landedNumber,
      committedAt,
      resolvedAt,
    });
  }
  return audits;
};

const sanitizeSessionAudit = (value: unknown): DrawSessionCancellation[] => {
  if (!Array.isArray(value)) return [];
  const audit: DrawSessionCancellation[] = [];
  for (const candidate of value) {
    if (audit.length >= MAX_SESSION_AUDIT_RECORDS) break;
    if (!isRecord(candidate)) continue;
    const sessionId = sanitizeId(candidate.sessionId);
    const startedAt = sanitizeDate(candidate.startedAt);
    const cancelledAt = sanitizeDate(candidate.cancelledAt);
    const reason = sanitizeOptionalText(candidate.reason, MAX_CANCELLATION_REASON_LENGTH);
    if (!sessionId || !startedAt || !cancelledAt || !reason) continue;
    audit.push({
      sessionId,
      status: "cancelled",
      game: normalizeGame(candidate.game),
      mode: normalizeDrawMode(candidate.mode),
      seed: sanitizeOptionalText(candidate.seed, MAX_ID_LENGTH),
      commitmentId: sanitizeOptionalText(candidate.commitmentId, MAX_ID_LENGTH),
      participantIds: Array.isArray(candidate.participantIds)
        ? Array.from(new Set(candidate.participantIds.flatMap((participantId) => {
            const id = sanitizeId(participantId);
            return id ? [id] : [];
          }))).slice(0, MAX_PARTICIPANTS)
        : [],
      roundCommitment: sanitizeRoundCommitment(candidate.roundCommitment),
      startedAt,
      cancelledAt,
      reason,
    });
  }
  return audit;
};

const markSessionCompleted = (
  session: ActiveDrawSession | null,
  completedAt = new Date().toISOString(),
): ActiveDrawSession | null => session
  ? { ...session, status: "completed", roundCommitment: null, completedAt }
  : null;

const clearActiveRoundCommitment = (session: ActiveDrawSession | null) =>
  session ? { ...session, roundCommitment: null } : null;

const assertNoCommittedSession = (session: ActiveDrawSession | null) => {
  if (session?.status === "committed") {
    throw new Error("Cancela la sesión activa con un motivo antes de modificar el sorteo.");
  }
};

const assertCommittedRound = (
  state: DrawState,
  game: GameId,
  selectedParticipantId?: string,
) => {
  const session = state.activeSession;
  if (!session || session.status !== "committed" || !session.roundCommitment) {
    throw new Error("No existe una ronda comprometida pendiente de resolución.");
  }
  const commitment = session.roundCommitment;
  if (session.game !== game || state.game !== game || session.mode !== state.mode) {
    throw new Error("El resultado no corresponde al juego y modo comprometidos.");
  }
  if (commitment.roundNumber !== state.roundNumber) {
    throw new Error("El resultado no corresponde a la ronda comprometida.");
  }
  if (selectedParticipantId) {
    if (!session.participantIds.includes(selectedParticipantId)) {
      throw new Error("El participante no pertenece al roster comprometido.");
    }
    if (state.eliminatedIds.includes(selectedParticipantId)) {
      throw new Error("El participante ya no es elegible en esta sesión.");
    }
    if (
      commitment.expectedParticipantId
      && commitment.expectedParticipantId !== selectedParticipantId
    ) {
      throw new Error("El resultado no coincide con el compromiso de la ronda.");
    }
  }
  return { session, commitment };
};

const attachRoundAudit = (
  state: DrawState,
  result: RoundResult,
  selectedParticipantId: string,
) => {
  const { session, commitment } = assertCommittedRound(state, state.game, selectedParticipantId);
  if (
    commitment.expectedLandedNumber !== undefined
    && commitment.expectedLandedNumber !== result.landedNumber
  ) {
    throw new Error("El número resuelto no coincide con el compromiso de la ronda.");
  }
  const auditId = makeId();
  const previousAuditHash = state.roundAudits[0]?.auditHash;
  const unsigned = {
    version: 1,
    auditId,
    previousAuditHash,
    sessionId: session.sessionId,
    game: session.game,
    mode: session.mode,
    roundNumber: commitment.roundNumber,
    participantIds: session.participantIds,
    commitmentId: commitment.commitmentId,
    revealedSeed: commitment.seed,
    selectedParticipantId,
    resultParticipantId: result.participantId,
    resultKind: result.kind,
    landedNumber: result.landedNumber,
    committedAt: commitment.committedAt,
    resolvedAt: result.createdAt,
  };
  const audit: RoundAudit = {
    ...unsigned,
    auditHash: sha256Hex(canonicalJson(unsigned)),
  };
  const auditedResult: RoundResult = {
    ...result,
    auditId,
    commitmentId: commitment.commitmentId,
    revealedSeed: commitment.seed,
    auditHash: audit.auditHash,
  };
  return { audit, result: auditedResult };
};

export const mergePersistedDrawState = (
  persistedState: unknown,
  currentState: DrawState,
): DrawState => {
  const stored = isRecord(persistedState) ? persistedState : {};
  const participants = Array.isArray(stored.participants)
    ? sanitizeParticipants(stored.participants)
    : currentState.participants;
  const participantIds = new Set(participants.map((participant) => participant.id));
  const sanitizeParticipantIdList = (value: unknown, fallback: string[]) =>
    Array.isArray(value)
      ? Array.from(new Set(value.flatMap((id) => {
          const sanitized = sanitizeId(id);
          return sanitized && participantIds.has(sanitized) ? [sanitized] : [];
        }))).slice(0, MAX_PARTICIPANTS)
      : fallback.filter((id) => participantIds.has(id));
  const eliminatedIds = sanitizeParticipantIdList(
    stored.eliminatedIds,
    currentState.eliminatedIds,
  );
  const blockedWinnerIds = sanitizeParticipantIdList(
    stored.blockedWinnerIds,
    currentState.blockedWinnerIds,
  );
  const history = Array.isArray(stored.history)
    ? sanitizeHistory(stored.history)
    : currentState.history;
  const winnerRecords = Array.isArray(stored.winnerRecords)
    ? sanitizeWinnerRecords(stored.winnerRecords)
    : currentState.winnerRecords;
  const roundNumber = sanitizeInteger(stored.roundNumber, 1, 10_000) ?? 1;
  const eliminationParity = stored.eliminationParity === "even" || stored.eliminationParity === "odd"
    ? stored.eliminationParity
    : null;
  const sanitizedActiveSession = sanitizeActiveSession(stored.activeSession);
  const activeSession = sanitizedActiveSession
    ? {
        ...sanitizedActiveSession,
        participantIds: sanitizedActiveSession.participantIds.filter((id) => participantIds.has(id)),
      }
    : null;
  const mode = activeSession?.status === "committed"
    ? activeSession.mode
    : normalizeDrawMode(stored.mode);
  const game = activeSession?.status === "committed"
    ? activeSession.game
    : normalizeGame(stored.game);
  const sessionAudit = Array.isArray(stored.sessionAudit)
    ? sanitizeSessionAudit(stored.sessionAudit)
    : currentState.sessionAudit;
  const roundAudits = Array.isArray(stored.roundAudits)
    ? sanitizeRoundAudits(stored.roundAudits)
    : currentState.roundAudits;
  return {
    ...currentState,
    participants,
    eliminatedIds,
    history,
    winnerRecords,
    blockedWinnerIds,
    eliminationParity,
    mode,
    game,
    marbleDifficulty: normalizeMarbleDifficulty(stored.marbleDifficulty),
    pinballControlMode: normalizePinballControlMode(stored.pinballControlMode),
    prize: sanitizeOptionalText(stored.prize, MAX_PRIZE_LENGTH) ?? "Premio del sorteo",
    roundNumber,
    activeSession,
    sessionAudit,
    roundAudits,
  };
};

export const migratePersistedDrawState = (
  persistedState: unknown,
  storedVersion: number,
) => {
  if (!isRecord(persistedState) || storedVersion > DRAW_STATE_VERSION) return {};
  if (storedVersion < DRAW_STATE_VERSION) {
    return {
      ...persistedState,
      eliminatedIds: Array.isArray(persistedState.eliminatedIds)
        ? persistedState.eliminatedIds
        : [],
      history: Array.isArray(persistedState.history) ? persistedState.history : [],
      eliminationParity:
        persistedState.eliminationParity === "even"
        || persistedState.eliminationParity === "odd"
          ? persistedState.eliminationParity
          : null,
      roundNumber:
        typeof persistedState.roundNumber === "number" ? persistedState.roundNumber : 1,
      activeSession: isRecord(persistedState.activeSession)
        ? persistedState.activeSession
        : null,
      sessionAudit: Array.isArray(persistedState.sessionAudit)
        ? persistedState.sessionAudit
        : [],
      roundAudits: Array.isArray(persistedState.roundAudits)
        ? persistedState.roundAudits
        : [],
    };
  }
  return persistedState;
};

const createWinnerRecord = (
  participant: Participant,
  prize: string,
  mode: DrawMode,
  game: GameId,
): WinnerRecord => ({
  id: makeId(),
  participantId: participant.id,
  participantName: participant.name,
  prize: prize.trim() || "Premio del sorteo",
  mode,
  game,
  createdAt: new Date().toISOString(),
});

export const useDrawStore = create<DrawState>()(
  persist(
    (set, get) => ({
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

      addNames: (rawNames) => {
        const state = get();
        assertNoCommittedSession(state.activeSession);
        const existing = new Set(
          state.participants.map((person) => participantNameKey(person.name)),
        );
        const uniqueNames: string[] = [];
        let skipped = 0;
        let rejectedCapacity = 0;
        const remainingCapacity = Math.max(0, MAX_PARTICIPANTS - state.participants.length);

        rawNames.forEach((rawName) => {
          const name = normalizeParticipantName(rawName);
          const key = participantNameKey(name);
          if (!name) return;
          if (existing.has(key)) {
            skipped += 1;
            return;
          }
          existing.add(key);
          if (uniqueNames.length >= remainingCapacity) {
            rejectedCapacity += 1;
            return;
          }
          uniqueNames.push(name);
        });

        if (uniqueNames.length > 0) {
          set((current) => ({
            participants: [
              ...current.participants,
              ...uniqueNames.map((participantName, index) =>
                makeParticipant(participantName, current.participants.length + index),
              ),
            ],
          }));
        }

        return { added: uniqueNames.length, skipped, rejectedCapacity };
      },

      removeParticipant: (id) => {
        assertNoCommittedSession(get().activeSession);
        set((state) => ({
          participants: state.participants.filter((person) => person.id !== id),
          eliminatedIds: state.eliminatedIds.filter((value) => value !== id),
          history: state.history.filter((result) => result.participantId !== id),
          blockedWinnerIds: state.blockedWinnerIds.filter((value) => value !== id),
        }));
      },

      clearParticipants: () => {
        assertNoCommittedSession(get().activeSession);
        set({
          participants: [],
          eliminatedIds: [],
          history: [],
          blockedWinnerIds: [],
          eliminationParity: null,
          roundNumber: 1,
        });
      },

      setMode: (mode) => {
        assertNoCommittedSession(get().activeSession);
        set({
          mode,
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        });
      },

      setGame: (game) => {
        assertNoCommittedSession(get().activeSession);
        set({
          game: normalizeGame(game),
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        });
      },

      setMarbleDifficulty: (marbleDifficulty) => {
        assertNoCommittedSession(get().activeSession);
        set({ marbleDifficulty });
      },

      setPinballControlMode: (pinballControlMode) => {
        assertNoCommittedSession(get().activeSession);
        set({ pinballControlMode });
      },

      setPrize: (prize) => {
        assertNoCommittedSession(get().activeSession);
        set({ prize: truncateText(prize, MAX_PRIZE_LENGTH) });
      },

      beginSession: (options = {}) => {
        const state = get();
        assertNoCommittedSession(state.activeSession);
        const session: ActiveDrawSession = {
          sessionId: makeId(),
          status: "committed",
          game: state.game,
          mode: state.mode,
          seed: sanitizeOptionalText(options.seed, MAX_ID_LENGTH),
          commitmentId: sanitizeOptionalText(options.commitmentId, MAX_ID_LENGTH),
          participantIds: state.participants
            .filter((participant) => !state.blockedWinnerIds.includes(participant.id))
            .map((participant) => participant.id),
          roundCommitment: null,
          startedAt: new Date().toISOString(),
        };
        set({
          activeSession: session,
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        });
        return session;
      },

      commitRound: (options) => {
        const state = get();
        const session = state.activeSession;
        if (!session || session.status !== "committed") {
          throw new Error("No hay una sesión comprometida para iniciar la ronda.");
        }
        if (session.roundCommitment) {
          throw new Error("La ronda actual ya tiene un compromiso pendiente.");
        }
        const commitmentId = sanitizeOptionalText(options.commitmentId, MAX_ID_LENGTH);
        if (!commitmentId) throw new Error("El identificador del compromiso es obligatorio.");
        const roundCommitment: ActiveRoundCommitment = {
          roundNumber: state.roundNumber,
          commitmentId,
          seed: sanitizeOptionalText(options.seed, MAX_ID_LENGTH),
          expectedParticipantId: sanitizeOptionalText(options.expectedParticipantId, MAX_ID_LENGTH),
          expectedLandedNumber: options.expectedLandedNumber === undefined
            ? undefined
            : sanitizeInteger(options.expectedLandedNumber, 0, 1_000_000) ?? undefined,
          committedAt: new Date().toISOString(),
        };
        if (
          roundCommitment.expectedParticipantId
          && !session.participantIds.includes(roundCommitment.expectedParticipantId)
        ) {
          throw new Error("El resultado esperado no pertenece al roster comprometido.");
        }
        set({ activeSession: { ...session, roundCommitment } });
        return roundCommitment;
      },

      clearRoundCommitment: () => {
        if (get().activeSession?.roundCommitment) {
          throw new Error("Una ronda comprometida solo puede resolverse o cancelarse con auditoría.");
        }
      },

      completeSession: () => {
        const state = get();
        if (state.activeSession?.roundCommitment) {
          throw new Error("Resuelve la ronda comprometida antes de completar la sesión.");
        }
        set({ activeSession: markSessionCompleted(state.activeSession) });
      },

      cancelSession: (rawReason) => {
        const reason = sanitizeOptionalText(rawReason, MAX_CANCELLATION_REASON_LENGTH);
        if (!reason) throw new Error("Debes indicar el motivo de cancelación.");
        const state = get();
        if (!state.activeSession) throw new Error("No hay una sesión activa para cancelar.");
        const cancellation: DrawSessionCancellation = {
          sessionId: state.activeSession.sessionId,
          status: "cancelled",
          game: state.activeSession.game,
          mode: state.activeSession.mode,
          seed: state.activeSession.seed,
          commitmentId: state.activeSession.commitmentId,
          participantIds: [...state.activeSession.participantIds],
          roundCommitment: state.activeSession.roundCommitment,
          startedAt: state.activeSession.startedAt,
          cancelledAt: new Date().toISOString(),
          reason,
        };
        set({
          activeSession: null,
          sessionAudit: [cancellation, ...state.sessionAudit]
            .slice(0, MAX_SESSION_AUDIT_RECORDS),
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        });
        return cancellation;
      },

      resumeSession: () => get().activeSession,

      startDraw: () => {
        assertNoCommittedSession(get().activeSession);
        set({
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        });
      },

      recordSelection: (participantId, landedNumber, selectionLabel) => {
        const state = get();
        const { session, commitment } = assertCommittedRound(state, state.game, participantId);
        if (
          commitment.expectedLandedNumber !== undefined
          && commitment.expectedLandedNumber !== landedNumber
        ) {
          throw new Error("El número recibido no coincide con la ronda comprometida.");
        }
        const participant = state.participants.find((person) => person.id === participantId);
        if (!participant) throw new Error("El participante ya no existe.");

        const activeParticipants = state.participants.filter(
          (person) =>
            session.participantIds.includes(person.id) &&
            !state.eliminatedIds.includes(person.id) &&
            !state.blockedWinnerIds.includes(person.id),
        );
        const parity: Parity = landedNumber % 2 === 0 ? "even" : "odd";
        let resultParticipant = participant;
        let selectedParticipantName: string | undefined;
        let kind: RoundResult["kind"] = "winner";
        let remainingCount = activeParticipants.length;
        let eligibleCount = activeParticipants.length;
        let nextEliminatedIds = state.eliminatedIds;
        let nextBlockedWinnerIds = state.blockedWinnerIds;
        let nextWinnerRecords = state.winnerRecords;
        let nextRound = state.roundNumber;
        let nextEliminationParity = state.eliminationParity;

        if (state.mode === "elimination") {
          nextEliminatedIds = Array.from(
            new Set([...state.eliminatedIds, participantId]),
          );
          const remaining = activeParticipants.filter((person) => person.id !== participantId);
          remainingCount = remaining.length;
          eligibleCount = remaining.length;
          nextEliminationParity = null;

          if (remaining.length === 1) {
            kind = "winner";
            resultParticipant = remaining[0];
            selectedParticipantName = participant.name;
            eligibleCount = 1;
            nextBlockedWinnerIds = Array.from(
              new Set([...state.blockedWinnerIds, resultParticipant.id]),
            );
            nextWinnerRecords = [
              createWinnerRecord(resultParticipant, state.prize, state.mode, state.game),
              ...state.winnerRecords,
            ].slice(0, MAX_WINNER_RECORDS);
          } else {
            kind = "eliminated";
            nextRound += 1;
          }
        } else {
          remainingCount = Math.max(0, activeParticipants.length - 1);
          eligibleCount = remainingCount;
          nextBlockedWinnerIds = Array.from(
            new Set([...state.blockedWinnerIds, participantId]),
          );
          nextWinnerRecords = [
            createWinnerRecord(participant, state.prize, state.mode, state.game),
            ...state.winnerRecords,
          ].slice(0, MAX_WINNER_RECORDS);
        }

        const result: RoundResult = {
          id: makeId(),
          participantId: resultParticipant.id,
          participantName: resultParticipant.name,
          selectedParticipantName,
          selectionLabel,
          kind,
          landedNumber,
          parity,
          mode: state.mode,
          game: state.game,
          prize: kind === "winner" ? state.prize.trim() || "Premio del sorteo" : undefined,
          round: state.roundNumber,
          remainingCount,
          eligibleCount,
          createdAt: new Date().toISOString(),
        };

        const audited = attachRoundAudit(state, result, participantId);
        set({
          history: [audited.result, ...state.history].slice(0, MAX_HISTORY_RECORDS),
          eliminatedIds: nextEliminatedIds,
          blockedWinnerIds: nextBlockedWinnerIds,
          winnerRecords: nextWinnerRecords,
          roundNumber: nextRound,
          eliminationParity: nextEliminationParity,
          activeSession:
            kind === "winner"
              ? markSessionCompleted(state.activeSession)
              : clearActiveRoundCommitment(state.activeSession),
          roundAudits: [audited.audit, ...state.roundAudits].slice(0, MAX_ROUND_AUDIT_RECORDS),
        });

        return audited.result;
      },

      recordParitySelection: (parity, landedNumber) => {
        void parity;
        void landedNumber;
        throw new Error("PAR e IMPAR son referencias visuales y no pueden resolver una ronda.");
      },

      recordDuckSurvival: (survivorId, knockouts) => {
        const state = get();
        const { session } = assertCommittedRound(state, "ducks", survivorId);
        if (state.mode !== "elimination") {
          throw new Error("Patos solo puede resolver una sesión en modo eliminación.");
        }
        const activeIds = session.participantIds.filter((id) => !state.eliminatedIds.includes(id));
        const knockoutIds = knockouts.map((knockout) => knockout.participantId);
        const uniqueKnockouts = new Set(knockoutIds);
        if (
          knockoutIds.length !== activeIds.length - 1
          || uniqueKnockouts.size !== knockoutIds.length
          || uniqueKnockouts.has(survivorId)
          || knockoutIds.some((id) => !activeIds.includes(id))
          || activeIds.some((id) => id !== survivorId && !uniqueKnockouts.has(id))
        ) {
          throw new Error("La supervivencia de Patos no contiene exactamente el roster comprometido.");
        }
        const survivor = state.participants.find((participant) => participant.id === survivorId);
        if (!survivor) throw new Error("El superviviente ya no existe.");
        const createdAt = new Date().toISOString();
        const eliminatedResults: RoundResult[] = knockouts.flatMap((knockout, index) => {
          const participant = state.participants.find((candidate) => candidate.id === knockout.participantId);
          if (!participant) return [];
          return [{
            id: makeId(),
            participantId: participant.id,
            participantName: participant.name,
            selectionLabel: `Pato #${knockout.number} · perdió sus 3 vidas`,
            kind: "eliminated" as const,
            landedNumber: knockout.number,
            parity: (knockout.number % 2 === 0 ? "even" : "odd") as Parity,
            mode: "elimination" as const,
            game: "ducks" as const,
            round: index + 1,
            remainingCount: Math.max(1, knockouts.length - index),
            eligibleCount: Math.max(1, knockouts.length - index),
            createdAt,
          } satisfies RoundResult];
        });
        const lastKnockout = eliminatedResults[eliminatedResults.length - 1];
        const survivorNumber = Math.max(1, activeIds.indexOf(survivorId) + 1);
        const winnerResult: RoundResult = {
          id: makeId(),
          participantId: survivor.id,
          participantName: survivor.name,
          selectedParticipantName: lastKnockout?.participantName,
          selectionLabel: `Pato #${survivorNumber} · último en pie`,
          kind: "winner",
          landedNumber: survivorNumber,
          parity: survivorNumber % 2 === 0 ? "even" : "odd",
          mode: "elimination",
          game: "ducks",
          prize: state.prize.trim() || "Premio del sorteo",
          round: Math.max(1, knockouts.length),
          remainingCount: 1,
          eligibleCount: 1,
          createdAt,
        };

        const audited = attachRoundAudit(state, winnerResult, survivorId);
        set({
          history: [audited.result, ...eliminatedResults.reverse(), ...state.history]
            .slice(0, MAX_HISTORY_RECORDS),
          eliminatedIds: Array.from(new Set([...state.eliminatedIds, ...knockouts.map((knockout) => knockout.participantId)])),
          blockedWinnerIds: Array.from(new Set([...state.blockedWinnerIds, survivor.id])),
          winnerRecords: [
            createWinnerRecord(survivor, state.prize, "elimination", "ducks"),
            ...state.winnerRecords,
          ].slice(0, MAX_WINNER_RECORDS),
          roundNumber: Math.max(1, knockouts.length + 1),
          eliminationParity: null,
          activeSession: markSessionCompleted(state.activeSession, createdAt),
          roundAudits: [audited.audit, ...state.roundAudits].slice(0, MAX_ROUND_AUDIT_RECORDS),
        });
        return audited.result;
      },

      reenableWinner: (participantId) => {
        assertNoCommittedSession(get().activeSession);
        set((state) => ({
          blockedWinnerIds: state.blockedWinnerIds.filter((id) => id !== participantId),
          eliminatedIds: state.eliminatedIds.filter((id) => id !== participantId),
        }));
      },

      reenableAllWinners: () => {
        assertNoCommittedSession(get().activeSession);
        set((state) => ({
          blockedWinnerIds: [],
          eliminatedIds: state.eliminatedIds.filter(
            (id) => !state.blockedWinnerIds.includes(id),
          ),
        }));
      },

      clearWinnerHistory: () => {
        assertNoCommittedSession(get().activeSession);
        set({ winnerRecords: [], blockedWinnerIds: [] });
      },

      resetDraw: () => {
        assertNoCommittedSession(get().activeSession);
        set({
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        });
      },
    }),
    {
      name: "fortuna-real-draw-v2",
      partialize: (state) => ({
        participants: state.participants,
        mode: state.mode,
        game: state.game,
        marbleDifficulty: state.marbleDifficulty,
        pinballControlMode: state.pinballControlMode,
        prize: state.prize,
        winnerRecords: state.winnerRecords,
        blockedWinnerIds: state.blockedWinnerIds,
        eliminatedIds: state.eliminatedIds,
        history: state.history,
        eliminationParity: state.eliminationParity,
        roundNumber: state.roundNumber,
        activeSession: state.activeSession,
        sessionAudit: state.sessionAudit,
        roundAudits: state.roundAudits,
      }),
      version: DRAW_STATE_VERSION,
      migrate: migratePersistedDrawState,
      merge: mergePersistedDrawState,
    },
  ),
);
