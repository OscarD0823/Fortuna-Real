import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DrawMode, Participant, RoundResult } from "../../core/types";

const PALETTE = [
  "#00d8d8",
  "#e6a10d",
  "#ef442c",
  "#12b981",
  "#008d91",
  "#f3c34d",
  "#da3124",
  "#43d17d",
  "#06777d",
  "#ffb315",
  "#f05a3c",
  "#06bcae",
];

const DEMO_NAMES = [
  "Valentina",
  "Andrés",
  "Camila",
  "Martín",
  "Fernanda",
  "Javier",
  "Lucas",
  "Bruno",
  "Tomás",
  "Alejandra",
  "Victoria",
  "Emilio",
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

interface DrawState {
  participants: Participant[];
  eliminatedIds: string[];
  pickedIds: string[];
  history: RoundResult[];
  mode: DrawMode;
  prize: string;
  addNames: (names: string[]) => { added: number; skipped: number };
  removeParticipant: (id: string) => void;
  clearParticipants: () => void;
  setMode: (mode: DrawMode) => void;
  setPrize: (prize: string) => void;
  recordSelection: (participantId: string) => RoundResult;
  resetDraw: () => void;
}

export const useDrawStore = create<DrawState>()(
  persist(
    (set, get) => ({
      participants: DEMO_NAMES.map(makeParticipant),
      eliminatedIds: [],
      pickedIds: [],
      history: [],
      mode: "direct",
      prize: "Premio del sorteo",

      addNames: (rawNames) => {
        const state = get();
        const existing = new Set(
          state.participants.map((person) => person.name.trim().toLocaleLowerCase()),
        );
        const uniqueNewNames: string[] = [];
        let skipped = 0;

        rawNames.forEach((rawName) => {
          const name = rawName.trim().replace(/\s+/g, " ");
          const key = name.toLocaleLowerCase();
          if (!name || existing.has(key)) {
            if (name) skipped += 1;
            return;
          }
          existing.add(key);
          uniqueNewNames.push(name.slice(0, 42));
        });

        if (uniqueNewNames.length > 0) {
          set((current) => ({
            participants: [
              ...current.participants,
              ...uniqueNewNames.map((name, index) =>
                makeParticipant(name, current.participants.length + index),
              ),
            ],
          }));
        }
        return { added: uniqueNewNames.length, skipped };
      },

      removeParticipant: (id) =>
        set((state) => ({
          participants: state.participants.filter((person) => person.id !== id),
          eliminatedIds: state.eliminatedIds.filter((value) => value !== id),
          pickedIds: state.pickedIds.filter((value) => value !== id),
          history: state.history.filter((result) => result.participantId !== id),
        })),

      clearParticipants: () =>
        set({ participants: [], eliminatedIds: [], pickedIds: [], history: [] }),

      setMode: (mode) =>
        set({ mode, eliminatedIds: [], pickedIds: [], history: [] }),

      setPrize: (prize) => set({ prize }),

      recordSelection: (participantId) => {
        const state = get();
        const participant = state.participants.find(
          (person) => person.id === participantId,
        );
        if (!participant) throw new Error("El participante ya no existe.");

        const result: RoundResult = {
          id: makeId(),
          participantId,
          participantName: participant.name,
          kind: state.mode === "direct" ? "winner" : "eliminated",
          createdAt: new Date().toISOString(),
        };

        const activeIds = state.participants
          .filter((person) => !state.eliminatedIds.includes(person.id))
          .map((person) => person.id);
        const pickedWithinActive = state.pickedIds.filter((id) =>
          activeIds.includes(id),
        );
        const completesCycle = pickedWithinActive.length + 1 >= activeIds.length;

        set({
          history: [result, ...state.history],
          pickedIds: completesCycle ? [] : [...pickedWithinActive, participantId],
          eliminatedIds:
            state.mode === "elimination"
              ? [...state.eliminatedIds, participantId]
              : state.eliminatedIds,
        });

        return result;
      },

      resetDraw: () => set({ eliminatedIds: [], pickedIds: [], history: [] }),
    }),
    {
      name: "fortuna-real-draw-v1",
      partialize: (state) => ({
        participants: state.participants,
        eliminatedIds: state.eliminatedIds,
        pickedIds: state.pickedIds,
        history: state.history,
        mode: state.mode,
        prize: state.prize,
      }),
    },
  ),
);
