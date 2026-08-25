import type { RoundResult } from "../src/core/types.ts";
import { resolveFinalWinner } from "../src/modules/results/finalWinner.ts";

const winner: RoundResult = {
  id: "winner-direct-contract",
  game: "marbles",
  mode: "direct",
  participantId: "p-1",
  participantName: "Ganadora de prueba",
  selectedParticipantName: "Ganadora de prueba",
  kind: "winner",
  parity: "odd",
  landedNumber: 1,
  remainingCount: 1,
  round: 1,
  eligibleCount: 1,
  prize: "Premio",
  createdAt: new Date(0).toISOString(),
};

for (const game of ["cards", "pinball", "marbles", "ducks"] as const) {
  const gameWinner = { ...winner, id: `${game}-winner`, game };
  if (resolveFinalWinner(null, gameWinner, 1)?.id !== gameWinner.id) {
    throw new Error(`${game} intentaría volver a montar su motor con una sola persona.`);
  }
  if (resolveFinalWinner(null, gameWinner, 2) !== null) {
    throw new Error(`${game} se cerró antes de agotar las personas elegibles.`);
  }
  if (resolveFinalWinner(gameWinner, null, 8)?.id !== gameWinner.id) {
    throw new Error(`${game} no respetó el ganador final de eliminación.`);
  }
}

console.log(JSON.stringify({
  games: ["cards", "pinball", "marbles", "ducks"],
  directLastEligibleGuard: true,
  eliminationWinnerGuard: true,
}, null, 2));
