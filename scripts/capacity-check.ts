import { buildCardAssignments, shuffleCards } from "../src/games/cards/cardDeck.ts";
import { arrangeEliminationEntries } from "../src/games/roulette/rouletteEntries.ts";
import { calculateSpinRotations } from "../src/games/roulette/rouletteMath.ts";
import {
  createPinballPhysicsBall,
  generatePinballLayout,
  getPinballFinishCrossing,
  launchPinballPhysicsBall,
  preparePinballRound,
  stepPinballPhysics,
  validatePinballLayout,
} from "../src/games/pinball/pinballEngine.ts";
import {
  generateMarbleTrack,
  getMarbleMotion,
  marbleDifficultyConfig,
  prepareMarbleRace,
  validateMarbleTrack,
} from "../src/games/marbles/marbleRaceEngine.ts";
import type { MarbleDifficulty, Participant, RouletteEntry } from "../src/core/types.ts";

const startedAt = performance.now();
let maxCardLogicMs = 0;
let maxRouletteLogicMs = 0;
let maxPinballLogicMs = 0;
let maxMarbleLogicMs = 0;
let pinballPhysicsSteps = 0;
let marbleMotionSamples = 0;
let marbleConnectorChecks = 0;
let marbleBridgeSections = 0;
let minimumMarbleCoverage = 1;
const pinballSignatures = new Set<string>();
const marbleSignatures = new Set<string>();

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
      const round = preparePinballRound(
        participants,
        drawMode,
        controlMode,
        `${seeds[0]}-${drawMode}-${controlMode}`,
      );
      if (
        round.balls.length !== count ||
        new Set(round.balls.map((ball) => ball.participant.id)).size !== count ||
        new Set(round.balls.map((ball) => ball.launchDelayMs)).size !== count ||
        round.controlMode !== controlMode ||
        round.drawMode !== drawMode ||
        round.layout.finishGate.width <= 0
      ) {
        throw new Error(`Asignación de pinball inválida para ${count}, ${drawMode}, ${controlMode}.`);
      }
    }
  }

  const simulation = preparePinballRound(participants, "direct", "automatic", seeds[0]);
  const gate = simulation.layout.finishGate;
  const crossing = getPinballFinishCrossing(gate.x, gate.z - 0.5, gate.x, gate.z + 0.5, gate);
  const outsideCrossing = getPinballFinishCrossing(gate.x + gate.width, gate.z - 0.5, gate.x + gate.width, gate.z + 0.5, gate);
  const reverseCrossing = getPinballFinishCrossing(gate.x, gate.z + 0.5, gate.x, gate.z - 0.5, gate);
  if (crossing === null || outsideCrossing !== null || reverseCrossing !== null) {
    throw new Error(`Sensor de meta inválido para ${count} pelotas.`);
  }
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

  caseStartedAt = performance.now();
  const difficulties: MarbleDifficulty[] = ["easy", "medium", "hard"];
  const marbleDifficulty = difficulties[count % difficulties.length];
  const marbleSeed = `marble-capacity-${count}`;
  const marbleTracks = [
    generateMarbleTrack(`${marbleSeed}-a`, marbleDifficulty),
    generateMarbleTrack(`${marbleSeed}-b`, marbleDifficulty),
  ];
  marbleTracks.forEach((track) => {
    const validation = validateMarbleTrack(track);
    const expected = marbleDifficultyConfig[marbleDifficulty];
    const xs = track.points.map((point) => point.x);
    const ys = track.points.map((point) => point.y);
    const coverage = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    minimumMarbleCoverage = Math.min(minimumMarbleCoverage, coverage);
    if (
      !validation.valid
      || track.sections.length !== expected.sectionCount
      || track.points.length <= track.sections.length * 4
      || coverage < 0.18
      || ![track.points[0].x, track.points[0].y].some((coordinate) =>
        Math.abs(coordinate - 0.065) < 0.00001 || Math.abs(coordinate - 0.935) < 0.00001,
      )
      || track.sections.some((section) =>
        !section.moduleId
        || section.speedMultiplier <= 0
        || section.surfaceGrip <= 0
        || section.connectorGap > 0.0001
        || ![section.entryHeading, section.exitHeading, section.clearance, section.bridgeLift].every(Number.isFinite),
      )
      || track.points.some((point) => !Number.isFinite(point.elevation) || !Number.isFinite(point.bank))
    ) {
      throw new Error(`Pista modular de canicas inválida para ${count} participantes (${track.signature}).`);
    }
    marbleConnectorChecks += track.sections.length;
    marbleBridgeSections += track.sections.filter((section) => section.bridgeLift > 0).length;
    marbleSignatures.add(track.signature);
  });
  if (marbleTracks[0].signature === marbleTracks[1].signature) {
    throw new Error(`Las piezas procedurales de canicas no cambiaron para ${count} participantes.`);
  }
  if ([2, 37, 100, 200].includes(count)) {
    const repeatedTrack = generateMarbleTrack(`${marbleSeed}-a`, marbleDifficulty);
    if (
      repeatedTrack.signature !== marbleTracks[0].signature
      || JSON.stringify(repeatedTrack.points) !== JSON.stringify(marbleTracks[0].points)
    ) {
      throw new Error(`La semilla procedural no fue reproducible para ${count} participantes.`);
    }
  }
  const marbleRace = prepareMarbleRace(participants, "direct", marbleSeed, marbleDifficulty);
  if (
    marbleRace.racers.length !== count
    || new Set(marbleRace.racers.map((racer) => racer.participant.id)).size !== count
    || marbleRace.selected.durationMs !== Math.min(...marbleRace.racers.map((racer) => racer.durationMs))
  ) {
    throw new Error(`Asignación de canicas inválida para ${count} participantes.`);
  }
  marbleRace.racers.forEach((racer) => {
    [0, 0.25, 0.5, 0.75, 1].forEach((timeRatio) => {
      const motion = getMarbleMotion(racer, marbleRace.track, racer.durationMs * timeRatio);
      if (
        ![motion.progress, motion.velocity, motion.lateralImpulse, motion.verticalOffset, motion.spinAngle].every(Number.isFinite)
        || motion.progress < 0
        || motion.progress > 1
        || (timeRatio === 1 && (!motion.finished || motion.progress !== 1))
      ) {
        throw new Error(`Movimiento de canica inválido para ${count}, jugador ${racer.number}, t=${timeRatio}.`);
      }
      marbleMotionSamples += 1;
    });
  });
  maxMarbleLogicMs = Math.max(maxMarbleLogicMs, performance.now() - caseStartedAt);
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
  marbleTracks: 398,
  marbleUniqueTracks: marbleSignatures.size,
  marbleMotionSamples,
  marbleConnectorChecks,
  marbleBridgeSections,
  minimumMarbleCoverage: Number(minimumMarbleCoverage.toFixed(3)),
  marblesIncludedInRelease: true,
  maxCardLogicMs: Number(maxCardLogicMs.toFixed(3)),
  maxRouletteLogicMs: Number(maxRouletteLogicMs.toFixed(3)),
  maxPinballLogicMs: Number(maxPinballLogicMs.toFixed(3)),
  maxMarbleLogicMs: Number(maxMarbleLogicMs.toFixed(3)),
  totalMs: Number((performance.now() - startedAt).toFixed(1)),
}));
