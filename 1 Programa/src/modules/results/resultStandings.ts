import type { DrawMode, GameStanding, Participant, ResultStanding, RoundResult } from "../../core/types.ts";

/** Persisted snapshots never depend on the current participant list. */
export function sanitizeStandings(value: unknown): ResultStanding[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 200) return undefined;
  const ids = new Set<string>();
  const positions = new Set<number>();
  const rows: ResultStanding[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const row = item as Partial<ResultStanding>;
    if (typeof row.participantId !== "string" || !row.participantId.trim() || row.participantId.length > 128
      || typeof row.participantName !== "string" || !row.participantName.trim() || Array.from(row.participantName).length > 42
      || ids.has(row.participantId) || !["winner", "eliminated", "not-selected"].includes(row.outcome ?? "")
      || (row.position !== null && (!Number.isInteger(row.position) || row.position! < 1 || row.position! > 200 || positions.has(row.position!)))
      || (row.outcome === "winner" && row.position === null)) return undefined;
    ids.add(row.participantId);
    if (row.position !== null) positions.add(row.position!);
    rows.push({ participantId: row.participantId, participantName: row.participantName, position: row.position!, outcome: row.outcome!,
      detail: typeof row.detail === "string" ? Array.from(row.detail.trim()).slice(0, 160).join("") || undefined : undefined,
      round: Number.isInteger(row.round) && row.round! > 0 && row.round! <= 10_000 ? row.round : undefined });
  }
  return rows.filter(row => row.outcome === "winner").length === 1 ? rows : undefined;
}

export function buildFinalStandings(
  participants: readonly Participant[], winnerId: string, mode: DrawMode,
  eliminatedIds: readonly string[], rounds: readonly RoundResult[], gameStandings?: readonly GameStanding[],
): ResultStanding[] {
  const roster = new Map(participants.map(person => [person.id, person]));
  if (!roster.has(winnerId)) throw new Error("El ganador no pertenece a la clasificación.");
  if (gameStandings) {
    const ids = new Set(gameStandings.map(row => row.participantId));
    const positions = new Set(gameStandings.map(row => row.position));
    if (gameStandings.length !== roster.size || ids.size !== roster.size || positions.size !== roster.size
      || gameStandings.some(row => !roster.has(row.participantId) || !Number.isInteger(row.position) || row.position < 1 || row.position > roster.size)) {
      throw new Error("La clasificación no contiene exactamente a todos los participantes de la partida.");
    }
  }
  if (mode === "direct") {
    const ordered = gameStandings?.slice().sort((a, b) => a.position - b.position)
      ?? [...participants].sort((a, b) => Number(b.id === winnerId) - Number(a.id === winnerId)).map(person => ({ participantId: person.id, position: person.id === winnerId ? 1 : null }));
    return ordered.map(row => ({ participantId: row.participantId, participantName: roster.get(row.participantId)!.name,
      position: row.position, outcome: row.participantId === winnerId ? "winner" : "not-selected",
      detail: "detail" in row && typeof row.detail === "string" ? row.detail.slice(0, 160) : undefined }));
  }
  const eliminated = [...new Set(eliminatedIds)].filter(id => id !== winnerId && roster.has(id));
  if (eliminated.length !== roster.size - 1) throw new Error("Faltan eliminaciones para completar la clasificación.");
  return [winnerId, ...eliminated.reverse()].map((id, index) => ({
    participantId: id, participantName: roster.get(id)!.name, position: index + 1,
    outcome: index === 0 ? "winner" : "eliminated",
    round: rounds.find(round => round.participantId === id || round.selectedParticipantId === id)?.round,
  }));
}
