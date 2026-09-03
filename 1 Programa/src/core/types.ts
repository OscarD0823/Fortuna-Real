export type DrawMode = "direct" | "elimination";
export type GameId = "roulette" | "cards" | "pinball" | "marbles" | "ducks";
export type PinballControlMode = "automatic" | "manual";
export type MarbleDifficulty = "easy" | "medium" | "hard";
export type MarbleFinishRule = "first" | "last";
export type Parity = "even" | "odd";

export interface Participant {
  id: string;
  name: string;
  color: string;
}

export interface RouletteEntry {
  id: string;
  kind: "participant" | "parity";
  label: string;
  color: string;
  number: number;
  participantId: string | null;
  parity: Parity;
  disabled?: boolean;
}

export interface WinnerRecord {
  id: string;
  participantId: string;
  participantName: string;
  prize: string;
  mode: DrawMode;
  game: GameId;
  createdAt: string;
}

export interface RoundResult {
  id: string;
  participantId: string | null;
  participantName: string;
  selectedParticipantName?: string;
  selectionLabel?: string;
  kind: "winner" | "eliminated" | "qualified" | "parity-selected";
  landedNumber: number;
  parity: Parity;
  mode: DrawMode;
  game: GameId;
  prize?: string;
  round: number;
  remainingCount: number;
  eligibleCount: number;
  createdAt: string;
  auditId?: string;
  commitmentId?: string;
  revealedSeed?: string;
  auditHash?: string;
}
