import type { GameId, RoundResult, WinnerRecord } from "../../core/types";

export const resultGameNames: Record<GameId, string> = {
  roulette: "Ruleta", cards: "Cartas", marbles: "Canicas", ducks: "Patos", pinball: "Pinball",
};
export const groupResultArchive = (results: readonly RoundResult[], cancelledIds: ReadonlySet<string> = new Set()) => {
  const matches = new Map<string, RoundResult[]>();
  for (const result of results) {
    if (result.sessionId && cancelledIds.has(result.sessionId)) continue;
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
  })).filter(match => Boolean(match.winner)).sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
};

export const completedArchive = (results: readonly RoundResult[], cancelledIds: ReadonlySet<string> = new Set()) =>
  groupResultArchive(results, cancelledIds).flatMap(match => match.rounds.slice().reverse());

export function publishedWinners(records: readonly WinnerRecord[], results: readonly RoundResult[], cancellations: readonly { sessionId: string }[]) {
  const cancelled = new Set(cancellations.map(entry => entry.sessionId));
  const complete = new Set(groupResultArchive(results, cancelled).map(match => match.id));
  // Older prizes have no session reference. Keep those genuine historical records.
  return records.filter(record => !record.sessionId || (!cancelled.has(record.sessionId) && complete.has(record.sessionId)));
}
