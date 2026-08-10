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

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

interface AddNamesResult {
  added: number;
  skipped: number;
}

interface DrawState {
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
  addNames: (names: string[]) => AddNamesResult;
  removeParticipant: (id: string) => void;
  clearParticipants: () => void;
  setMode: (mode: DrawMode) => void;
  setGame: (game: GameId) => void;
  setMarbleDifficulty: (difficulty: MarbleDifficulty) => void;
  setPinballControlMode: (mode: PinballControlMode) => void;
  setPrize: (prize: string) => void;
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

export const mergePersistedDrawState = (
  persistedState: unknown,
  currentState: DrawState,
): DrawState => {
  const stored = (persistedState ?? {}) as Partial<DrawState>;
  return {
    ...currentState,
    ...stored,
    mode: normalizeDrawMode(stored.mode),
    game: normalizeGame(stored.game),
    marbleDifficulty: normalizeMarbleDifficulty(stored.marbleDifficulty),
    pinballControlMode: normalizePinballControlMode(stored.pinballControlMode),
    winnerRecords: (stored.winnerRecords ?? currentState.winnerRecords).map(
      (record) => ({
        ...record,
        mode: normalizeDrawMode(record.mode),
        game: normalizeGame(record.game),
      }),
    ),
  };
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

      addNames: (rawNames) => {
        const state = get();
        const existing = new Set(
          state.participants.map((person) => person.name.trim().toLocaleLowerCase()),
        );
        const uniqueNames: string[] = [];
        let skipped = 0;

        rawNames.forEach((rawName) => {
          const name = rawName.trim().replace(/\s+/g, " ");
          const key = name.toLocaleLowerCase();
          if (!name) return;
          if (existing.has(key)) {
            skipped += 1;
            return;
          }
          existing.add(key);
          uniqueNames.push(name.slice(0, 42));
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

        return { added: uniqueNames.length, skipped };
      },

      removeParticipant: (id) =>
        set((state) => ({
          participants: state.participants.filter((person) => person.id !== id),
          eliminatedIds: state.eliminatedIds.filter((value) => value !== id),
          history: state.history.filter((result) => result.participantId !== id),
          winnerRecords: state.winnerRecords.filter((winner) => winner.participantId !== id),
          blockedWinnerIds: state.blockedWinnerIds.filter((value) => value !== id),
        })),

      clearParticipants: () =>
        set({
          participants: [],
          eliminatedIds: [],
          history: [],
          winnerRecords: [],
          blockedWinnerIds: [],
          eliminationParity: null,
          roundNumber: 1,
        }),

      setMode: (mode) =>
        set({
          mode,
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        }),

      setGame: (game) =>
        set({
          game: normalizeGame(game),
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        }),

      setMarbleDifficulty: (marbleDifficulty) => set({ marbleDifficulty }),

      setPinballControlMode: (pinballControlMode) => set({ pinballControlMode }),

      setPrize: (prize) => set({ prize }),

      startDraw: () =>
        set({
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        }),

      recordSelection: (participantId, landedNumber, selectionLabel) => {
        const state = get();
        const participant = state.participants.find((person) => person.id === participantId);
        if (!participant) throw new Error("El participante ya no existe.");

        const activeParticipants = state.participants.filter(
          (person) =>
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
            ];
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
          ];
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

        set({
          history: [result, ...state.history],
          eliminatedIds: nextEliminatedIds,
          blockedWinnerIds: nextBlockedWinnerIds,
          winnerRecords: nextWinnerRecords,
          roundNumber: nextRound,
          eliminationParity: nextEliminationParity,
        });

        return result;
      },

      recordParitySelection: (parity, landedNumber) => {
        const state = get();
        const activeParticipants = state.participants.filter(
          (person) =>
            !state.eliminatedIds.includes(person.id) &&
            !state.blockedWinnerIds.includes(person.id),
        );
        const eligibleCount = activeParticipants.filter(
          (_, index) => ((index + 1) % 2 === 0 ? "even" : "odd") === parity,
        ).length;
        const parityName = parity === "even" ? "PAR" : "IMPAR";
        const result: RoundResult = {
          id: makeId(),
          participantId: null,
          participantName: parityName,
          kind: "parity-selected",
          landedNumber,
          parity,
          mode: state.mode,
          game: "roulette",
          selectionLabel: `Casilla ${parityName}`,
          round: state.roundNumber,
          remainingCount: activeParticipants.length,
          eligibleCount,
          createdAt: new Date().toISOString(),
        };

        set({
          eliminationParity: parity,
          history: [result, ...state.history],
          roundNumber: state.roundNumber + 1,
        });
        return result;
      },

      recordDuckSurvival: (survivorId, knockouts) => {
        const state = get();
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
        const survivorNumber = Math.max(1, state.participants.findIndex((participant) => participant.id === survivorId) + 1);
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

        set({
          history: [winnerResult, ...eliminatedResults.reverse(), ...state.history],
          eliminatedIds: Array.from(new Set([...state.eliminatedIds, ...knockouts.map((knockout) => knockout.participantId)])),
          blockedWinnerIds: Array.from(new Set([...state.blockedWinnerIds, survivor.id])),
          winnerRecords: [
            createWinnerRecord(survivor, state.prize, "elimination", "ducks"),
            ...state.winnerRecords,
          ],
          roundNumber: Math.max(1, knockouts.length + 1),
          eliminationParity: null,
        });
        return winnerResult;
      },

      reenableWinner: (participantId) =>
        set((state) => ({
          blockedWinnerIds: state.blockedWinnerIds.filter((id) => id !== participantId),
          eliminatedIds: state.eliminatedIds.filter((id) => id !== participantId),
        })),

      reenableAllWinners: () =>
        set((state) => ({
          blockedWinnerIds: [],
          eliminatedIds: state.eliminatedIds.filter(
            (id) => !state.blockedWinnerIds.includes(id),
          ),
        })),

      clearWinnerHistory: () =>
        set({ winnerRecords: [], blockedWinnerIds: [] }),

      resetDraw: () =>
        set({
          eliminatedIds: [],
          history: [],
          eliminationParity: null,
          roundNumber: 1,
        }),
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
      }),
      merge: mergePersistedDrawState,
    },
  ),
);
