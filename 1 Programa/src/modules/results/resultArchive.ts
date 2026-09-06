import type { GameId, RoundResult } from "../../core/types";

export const resultGameNames: Record<GameId, string> = {
  roulette: "Ruleta", cards: "Cartas", marbles: "Canicas", ducks: "Patos", pinball: "Pinball",
};
export const groupResultArchive = (results: readonly RoundResult[]) => {
  const matches = new Map<string, RoundResult[]>();
  for (const result of results) {
    const key = result.sessionId ?? `legacy-${result.id}`;
    const entries = matches.get(key) ?? [];
    entries.push(result);
    matches.set(key, entries);
  }
  return [...matches].map(([id, rounds]) => ({
    id,
    rounds: rounds.slice().sort((a, b) => a.round - b.round || Number(a.kind === "winner") - Number(b.kind === "winner")),
    winner: rounds.find((round) => round.kind === "winner"),
    latest: rounds.reduce((a, b) => a.createdAt > b.createdAt ? a : b),
    legacy: id.startsWith("legacy-"),
  })).sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
};
