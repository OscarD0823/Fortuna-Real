import { buildCardAssignments, shuffleCards } from "../src/games/cards/cardDeck.ts";
import { arrangeEliminationEntries } from "../src/games/roulette/rouletteEntries.ts";
import { calculateSpinRotations } from "../src/games/roulette/rouletteMath.ts";
import {
  createPinballPhysicsBall,
  generatePinballLayout,
  launchPinballPhysicsBall,
  preparePinballRound,
  stepPinballPhysics,
  validatePinballLayout,
} from "../src/games/pinball/pinballEngine.ts";
import type { Participant, RouletteEntry } from "../src/core/types.ts";

const startedAt = performance.now();
let maxCardLogicMs = 0;
let maxRouletteLogicMs = 0;
let maxPinballLogicMs = 0;
let pinballPhysicsSteps = 0;
const pinballSignatures = new Set<string>();

for (let count = 2; count <= 200; count += 1) {
  const participants: Participant[] = Array.from({ length: count }, (_, index) => ({
    id: `p-${count}-${index}`,
    name: `Participante ${index + 1}`,
    color: `hsl(${index % 360} 70% 50%)`,
  }));

  let caseStartedAt = performance.now();
  const cards = buildCardAssignments(participants, () => 0.314159);
  const shuffledCards = shuffleCards(cards, () => 0.271828);
  maxCardLogicMs = Math.max(maxCardLogicMs, performance.now() - caseStartedAt);
  if (
    cards.length !== count ||
    new Set(cards.map((card) => card.id)).size !== count ||
    new Set(shuffledCards.map((card) => card.id)).size !== count ||
    new Set(shuffledCards.map((card) => card.participant.id)).size !== count
  ) {
    throw new Error(`Asignación de cartas inválida para ${count} participantes.`);
  }

  caseStartedAt = performance.now();
  const participantEntries: RouletteEntry[] = participants.map((participant, index) => ({
    id: `entry-${participant.id}`,
    kind: "participant",
    label: participant.name,
    color: participant.color,
    number: index + 1,
    participantId: participant.id,
    parity: (index + 1) % 2 === 0 ? "even" : "odd",
  }));
  const eliminationEntries = arrangeEliminationEntries(participantEntries);
  if (
    eliminationEntries.length !== count + 2 ||
    eliminationEntries.filter((entry) => entry.kind === "parity").length !== 2 ||
    new Set(eliminationEntries.map((entry) => entry.id)).size !== count + 2
  ) {
    throw new Error(`Distribución de ruleta inválida para ${count} participantes.`);
  }

  for (const entryCount of [count, count + 2]) {
    for (const targetIndex of [0, Math.floor(entryCount / 2), entryCount - 1]) {
      const spin = calculateSpinRotations({
        entryCount,
        targetIndex,
        ballLandingAngle: 137.25,
        currentWheelRotation: 913.7,
        currentBallRotation: -2011.2,
      });
      if (!Number.isFinite(spin.wheelRotation) || !Number.isFinite(spin.ballRotation)) {
        throw new Error(`Giro de ruleta inválido para ${entryCount} casillas.`);
      }
    }
  }
  maxRouletteLogicMs = Math.max(maxRouletteLogicMs, performance.now() - caseStartedAt);

  caseStartedAt = performance.now();
  const seeds = [`capacity-${count}-a`, `capacity-${count}-b`];
  const layouts = seeds.map((seed) => generatePinballLayout(seed, count));
  layouts.forEach((layout) => {
    const validation = validatePinballLayout(layout);
    if (!validation.valid) {
      throw new Error(`Mesa de pinball inválida para ${count} pelotas (${layout.signature}).`);
    }
    pinballSignatures.add(layout.signature);
  });
  if (layouts[0].signature === layouts[1].signature) {
    throw new Error(`La distribución procedural no cambió para ${count} pelotas.`);
  }

  for (const drawMode of ["direct", "elimination"] as const) {
    for (const controlMode of ["automatic", "manual"] as const) {
      const selectedIndex = Math.floor(count * 0.618) % count;
      const round = preparePinballRound(
        participants,
        drawMode,
        controlMode,
        `${seeds[0]}-${drawMode}-${controlMode}`,
        selectedIndex,
      );
      if (
        round.balls.length !== count ||
        round.selected.participant.id !== participants[selectedIndex].id ||
        new Set(round.balls.map((ball) => ball.participant.id)).size !== count ||
        round.controlMode !== controlMode ||
        round.drawMode !== drawMode
      ) {
        throw new Error(`Asignación de pinball inválida para ${count}, ${drawMode}, ${controlMode}.`);
      }
    }
  }

  const simulation = preparePinballRound(participants, "direct", "automatic", seeds[0], count - 1);
  const physicsBalls = simulation.balls.map((assignment) => {
    const ball = createPinballPhysicsBall(assignment, simulation.layout);
    launchPinballPhysicsBall(ball, assignment, simulation.layout);
    return ball;
  });
  for (let step = 0; step < 12; step += 1) {
    physicsBalls.forEach((ball, index) => {
      stepPinballPhysics(ball, simulation.layout, 1 / 60, {
        left: step % 4 === 0 && index % 2 === 0,
        right: step % 4 === 0 && index % 2 === 1,
      });
      if (![ball.x, ball.z, ball.vx, ball.vz].every(Number.isFinite)) {
        throw new Error(`Física no finita para ${count} pelotas, paso ${step}.`);
      }
      pinballPhysicsSteps += 1;
    });
  }
  maxPinballLogicMs = Math.max(maxPinballLogicMs, performance.now() - caseStartedAt);
}

console.log(JSON.stringify({
  sizesTested: "2..200",
  participantCounts: 199,
  cardAssignmentsAndShuffles: 398,
  rouletteLayouts: 199,
  rouletteTargetSpins: 1194,
  pinballLayouts: 398,
  pinballModeAssignments: 796,
  pinballUniqueLayouts: pinballSignatures.size,
  pinballPhysicsSteps,
  marblesIncludedInRelease: false,
  maxCardLogicMs: Number(maxCardLogicMs.toFixed(3)),
  maxRouletteLogicMs: Number(maxRouletteLogicMs.toFixed(3)),
  maxPinballLogicMs: Number(maxPinballLogicMs.toFixed(3)),
  totalMs: Number((performance.now() - startedAt).toFixed(1)),
}));
