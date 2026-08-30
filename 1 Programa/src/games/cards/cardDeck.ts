import type { Participant } from "../../core/types";
import { sha256Hex } from "../../shared/crypto/sha256.ts";
import { uniformIndexFromUint32 } from "../roulette/rouletteCommitment.ts";

export const CARD_SUITS = [
  { id: "hearts", symbol: "♥", name: "corazones", red: true },
  { id: "diamonds", symbol: "♦", name: "diamantes", red: true },
  { id: "clubs", symbol: "♣", name: "tréboles", red: false },
  { id: "spades", symbol: "♠", name: "picas", red: false },
] as const;

export const CARD_RANKS = [
  { id: "A", spoken: "As" },
  { id: "2", spoken: "Dos" },
  { id: "3", spoken: "Tres" },
  { id: "4", spoken: "Cuatro" },
  { id: "5", spoken: "Cinco" },
  { id: "6", spoken: "Seis" },
  { id: "7", spoken: "Siete" },
  { id: "8", spoken: "Ocho" },
  { id: "9", spoken: "Nueve" },
  { id: "10", spoken: "Diez" },
  { id: "J", spoken: "Jota" },
  { id: "Q", spoken: "Reina" },
  { id: "K", spoken: "Rey" },
] as const;

export interface CardAssignment {
  id: string;
  rank: string;
  suitId: string;
  suitSymbol: string;
  isRed: boolean;
  label: string;
  deckNumber: number;
  participant: Participant;
}

const secureUnit = () => {
  if (typeof crypto === "undefined" || !("getRandomValues" in crypto)) {
    throw new Error("Este equipo no ofrece una fuente criptográfica segura.");
  }
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 2 ** 32;
};

export const createCardSeed = () => {
  if (typeof crypto === "undefined" || !("getRandomValues" in crypto)) {
    throw new Error("Este equipo no ofrece una fuente criptográfica segura.");
  }
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
};

export const hashCardSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createCardRandom = (seed: string) => {
  const drawUint32 = createCardUint32(seed);
  return () => drawUint32() / 4294967296;
};

export const createCardUint32 = (seed: string) => {
  let counter = 0;
  let pool: number[] = [];
  return () => {
    if (pool.length === 0) {
      const digest = sha256Hex(`${seed}:${counter}`);
      counter += 1;
      pool = Array.from({ length: 8 }, (_, index) =>
        Number.parseInt(digest.slice(index * 8, index * 8 + 8), 16) >>> 0,
      );
    }
    return pool.shift() ?? 0;
  };
};

export const shuffleCards = <T,>(items: readonly T[], random = secureUnit): T[] => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
};

export const buildCardAssignments = (
  participants: readonly Participant[],
  random = secureUnit,
): CardAssignment[] => {
  const shuffledParticipants = shuffleCards(participants, random);

  return shuffledParticipants.map((participant, index) => {
    const cardIndex = index % 52;
    const suit = CARD_SUITS[Math.floor(cardIndex / 13)];
    const rank = CARD_RANKS[cardIndex % 13];
    const deckNumber = Math.floor(index / 52) + 1;
    const deckSuffix = deckNumber > 1 ? ` · mazo ${deckNumber}` : "";

    return {
      id: `card-${deckNumber}-${suit.id}-${rank.id}-${participant.id}`,
      rank: rank.id,
      suitId: suit.id,
      suitSymbol: suit.symbol,
      isRed: suit.red,
      label: `${rank.spoken} de ${suit.name}${deckSuffix}`,
      deckNumber,
      participant,
    };
  });
};

export interface PreparedCardRound {
  seed: string;
  assigned: CardAssignment[];
  shuffled: CardAssignment[];
  selected: CardAssignment;
  commitmentId: string;
}

export const prepareCardRound = (
  participants: readonly Participant[],
  seed: string,
): PreparedCardRound => {
  if (participants.length < 2) throw new Error("Cartas necesita al menos dos participantes.");
  const assigned = buildCardAssignments(participants, createCardRandom(`assign-${seed}`));
  const shuffled = shuffleCards(assigned, createCardRandom(`shuffle-${seed}`));
  const selected = shuffled[uniformIndexFromUint32(shuffled.length, createCardUint32(`result-${seed}`))];
  const proof = [
    "fortuna-card-v2",
    ...assigned.map((assignment) => assignment.participant.id),
    "shuffle",
    ...shuffled.map((assignment) => assignment.participant.id),
    "selected",
    selected.participant.id,
  ].join("|");
  return {
    seed,
    assigned,
    shuffled,
    selected,
    commitmentId: `CARD-${sha256Hex(proof).toUpperCase()}`,
  };
};
