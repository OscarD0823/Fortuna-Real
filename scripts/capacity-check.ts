import { buildCardAssignments, shuffleCards } from "../src/games/cards/cardDeck.ts";
import {
  generateMarbleTrack,
  getMarbleProgress,
  getTrackPosition,
  prepareMarbleRace,
  powersByDifficulty,
  validateMarbleTrack,
} from "../src/games/marbles/marbleRaceEngine.ts";
import { arrangeEliminationEntries } from "../src/games/roulette/rouletteEntries.ts";
import { calculateSpinRotations } from "../src/games/roulette/rouletteMath.ts";
import type { DrawMode, MarbleDifficulty, Participant, RouletteEntry } from "../src/core/types.ts";

const startedAt = performance.now();
let maxCardLogicMs = 0;
let maxMarbleLogicMs = 0;
const proceduralLayouts = new Set<string>();
const difficultyRanges: Record<MarbleDifficulty, { sections: number; zones: number; obstacleMin: number; obstacleMax: number; powers: number; width: number; minimumFeatureScale: number }> = {
  easy: { sections: 20, zones: 4, obstacleMin: 1, obstacleMax: 1, powers: 1, width: 68, minimumFeatureScale: 0.7 },
  medium: { sections: 32, zones: 6, obstacleMin: 5, obstacleMax: 7, powers: 5, width: 76, minimumFeatureScale: 0.86 },
  hard: { sections: 44, zones: 8, obstacleMin: 10, obstacleMax: 14, powers: 9, width: 84, minimumFeatureScale: 1.03 },
};

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
    new Set(shuffledCards.map((card) => card.id)).size !== count
  ) {
    throw new Error(`Asignación de cartas inválida para ${count} participantes.`);
  }

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
    eliminationEntries.filter((entry) => entry.kind === "parity").length !== 2
  ) {
    throw new Error(`Distribución de ruleta inválida para ${count} participantes.`);
  }
  for (const entryCount of [count, count + 2]) {
    const spin = calculateSpinRotations({
      entryCount,
      targetIndex: entryCount - 1,
      ballLandingAngle: 137.25,
      currentWheelRotation: 913.7,
      currentBallRotation: -2011.2,
    });
    if (!Number.isFinite(spin.wheelRotation) || !Number.isFinite(spin.ballRotation)) {
      throw new Error(`Giro de ruleta inválido para ${entryCount} casillas.`);
    }
  }

  caseStartedAt = performance.now();
  for (const difficulty of ["easy", "medium", "hard"] satisfies MarbleDifficulty[]) {
    const layoutSeed = `layout-${count}-${difficulty}`;
    const track = generateMarbleTrack(layoutSeed, difficulty);
    const repeatedTrack = generateMarbleTrack(layoutSeed, difficulty);
    const validation = validateMarbleTrack(track);
    const expected = difficultyRanges[difficulty];
    const layoutKey = `${difficulty}:${track.points.map((point) => `${point.x},${point.y}`).join("|")}`;
    if (proceduralLayouts.has(layoutKey)) {
      throw new Error(`La pista procedural se repitió para ${count} participantes en dificultad ${difficulty}.`);
    }
    proceduralLayouts.add(layoutKey);
    if (
      !validation.valid ||
      track.sections.length !== expected.sections ||
      track.zones.length !== expected.zones ||
      track.obstacles.length < expected.obstacleMin ||
      track.obstacles.length > expected.obstacleMax ||
      track.powerZones.length !== expected.powers ||
      track.trackWidth !== expected.width ||
      track.obstacles.some((obstacle) => obstacle.scale < expected.minimumFeatureScale) ||
      track.powerZones.some((zone) => zone.scale < expected.minimumFeatureScale) ||
      track.sections.some((section) => !track.zones.some((zone) => zone.id === section.zoneId)) ||
      JSON.stringify(track) !== JSON.stringify(repeatedTrack)
    ) {
      throw new Error(`Generación procedural inválida para ${count} participantes en dificultad ${difficulty}.`);
    }

    for (const mode of ["direct", "elimination"] satisfies DrawMode[]) {
      const race = prepareMarbleRace(participants, mode, `test-${count}-${mode}-${difficulty}`, difficulty);
      if (race.racers.length !== count || !validateMarbleTrack(race.track).valid) {
        throw new Error(`Carrera de canicas inválida para ${count} participantes.`);
      }
      const allowedPowers = new Set(powersByDifficulty[difficulty]);
      if (race.racers.some((racer) => racer.power !== null && !allowedPowers.has(racer.power))) {
        throw new Error(`Poder no permitido en dificultad ${difficulty}.`);
      }
      const durations = race.racers.map((racer) => racer.durationMs);
      const expectedDuration = mode === "direct" ? Math.min(...durations) : Math.max(...durations);
      if (race.selected.durationMs !== expectedDuration) {
        throw new Error(`Resultado de canicas inválido para ${count} participantes en modo ${mode}.`);
      }
      race.racers.forEach((racer) => {
        const state = getMarbleProgress(racer, racer.durationMs * 0.5);
        const point = getTrackPosition(race.track.points, state.progress);
        if (
          !Number.isFinite(state.progress) ||
          state.progress < 0 ||
          state.progress > 1 ||
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y)
        ) {
          throw new Error(`Progreso de canica inválido para ${count} participantes.`);
        }
      });
    }
  }
  maxMarbleLogicMs = Math.max(maxMarbleLogicMs, performance.now() - caseStartedAt);
}

console.log(JSON.stringify({
  sizesTested: "2..200",
  participantCounts: 199,
  cardAssignmentsAndShuffles: 398,
  rouletteLayoutsAndSpins: 398,
  marbleRaces: 1194,
  proceduralTracksValidated: proceduralLayouts.size,
  proceduralZonesValidated: proceduralLayouts.size * 6,
  difficulties: ["easy", "medium", "hard"],
  maxCardLogicMs: Number(maxCardLogicMs.toFixed(3)),
  maxMarbleLogicMs: Number(maxMarbleLogicMs.toFixed(3)),
  totalMs: Number((performance.now() - startedAt).toFixed(1)),
}));
