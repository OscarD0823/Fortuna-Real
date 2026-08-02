export type DrawMode = "direct" | "elimination";

export interface Participant {
  id: string;
  name: string;
  color: string;
}

export interface RoundResult {
  id: string;
  participantId: string;
  participantName: string;
  kind: "winner" | "eliminated";
  createdAt: string;
}
