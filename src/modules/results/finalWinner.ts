import type { RoundResult } from "../../core/types";

/**
 * Evita volver a montar un motor que exige dos participantes cuando una ronda
 * directa acaba de bloquear al ganador y solo queda una persona habilitada.
 */
export const resolveFinalWinner = (
  sessionWinner: RoundResult | null,
  latestResult: RoundResult | null,
  activeParticipantCount: number,
) => sessionWinner
  ?? (activeParticipantCount < 2 && latestResult?.kind === "winner" ? latestResult : null);
