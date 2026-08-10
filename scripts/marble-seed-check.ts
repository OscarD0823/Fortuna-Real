import type { MarbleDifficulty } from "../src/core/types.ts";
import {
  generateMarbleTrack,
  marbleDifficultyConfig,
  validateMarbleTrack,
} from "../src/games/marbles/marbleRaceEngine.ts";

const difficulties: MarbleDifficulty[] = ["easy", "medium", "hard"];
const seedsPerDifficulty = 120;
const allSignatures = new Set<string>();

const round = (value: number, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const average = (values: readonly number[]) => values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);

const edgeForPoint = (x: number, y: number) => {
  if (Math.abs(x - 0.065) < 0.00001) return "left";
  if (Math.abs(x - 0.935) < 0.00001) return "right";
  if (Math.abs(y - 0.065) < 0.00001) return "top";
  if (Math.abs(y - 0.935) < 0.00001) return "bottom";
  return "invalid";
};

const reports = difficulties.map((difficulty) => {
  const config = marbleDifficultyConfig[difficulty];
  const coverages: number[] = [];
  const bridgeCounts: number[] = [];
  const pointCounts: number[] = [];
  const generationTimes: number[] = [];
  const signatures = new Set<string>();
  const modules = new Set<string>();
  const starts = { left: 0, right: 0, top: 0, bottom: 0, invalid: 0 };
  const sampleSeeds: Array<{ seed: string; signature: string; coverage: number; bridges: number }> = [];

  for (let index = 0; index < seedsPerDifficulty; index += 1) {
    const seed = `fortuna-${difficulty}-${String(index + 1).padStart(3, "0")}`;
    const startedAt = performance.now();
    const track = generateMarbleTrack(seed, difficulty);
    generationTimes.push(performance.now() - startedAt);
    const validation = validateMarbleTrack(track);
    const xs = track.points.map((point) => point.x);
    const ys = track.points.map((point) => point.y);
    const coverage = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    const bridges = track.sections.filter((section) => section.bridgeLift > 0).length;
    const edge = edgeForPoint(track.points[0].x, track.points[0].y);
    starts[edge] += 1;

    const connectorsValid = track.sections.every((section, sectionIndex) => {
      const previous = sectionIndex > 0 ? track.sections[sectionIndex - 1] : null;
      return section.connectorGap <= 0.0001
        && (previous === null || previous.endPointIndex === section.startPointIndex)
        && (previous === null || Math.abs(previous.exitHeading - section.entryHeading) <= 0.0002)
        && (section.clearance >= 0.055 ? section.bridgeLift === 0 : section.bridgeLift > 0);
    });

    if (
      !validation.valid
      || !connectorsValid
      || coverage < 0.18
      || edge === "invalid"
      || track.sections.length !== config.sectionCount
      || track.points.length <= track.sections.length * 4
      || track.obstacles.length < config.obstacleMin
      || track.obstacles.length > config.obstacleMax
      || track.powerZones.length !== config.powerZones
      || signatures.has(track.signature)
      || allSignatures.has(track.signature)
    ) {
      throw new Error(`Semilla inválida: ${seed} (${track.signature}).`);
    }

    if (index < 6) {
      const repeated = generateMarbleTrack(seed, difficulty);
      if (repeated.signature !== track.signature || JSON.stringify(repeated.points) !== JSON.stringify(track.points)) {
        throw new Error(`La semilla ${seed} no se reprodujo exactamente.`);
      }
    }

    track.sections.forEach((section) => modules.add(section.moduleId));
    signatures.add(track.signature);
    allSignatures.add(track.signature);
    coverages.push(coverage);
    bridgeCounts.push(bridges);
    pointCounts.push(track.points.length);
    if (sampleSeeds.length < 4 && index % 29 === 0) {
      sampleSeeds.push({ seed, signature: track.signature, coverage: round(coverage), bridges });
    }
  }

  if (Object.values(starts).slice(0, 4).some((count) => count === 0)) {
    throw new Error(`La dificultad ${difficulty} no utilizó los cuatro bordes de salida.`);
  }

  return {
    difficulty,
    seeds: signatures.size,
    modulesUsed: modules.size,
    startEdges: starts,
    coverage: {
      minimum: round(Math.min(...coverages)),
      average: round(average(coverages)),
      maximum: round(Math.max(...coverages)),
    },
    bridges: {
      minimum: Math.min(...bridgeCounts),
      average: round(average(bridgeCounts), 1),
      maximum: Math.max(...bridgeCounts),
    },
    points: {
      minimum: Math.min(...pointCounts),
      average: round(average(pointCounts), 1),
      maximum: Math.max(...pointCounts),
    },
    generationMs: {
      average: round(average(generationTimes), 2),
      maximum: round(Math.max(...generationTimes), 2),
    },
    sampleSeeds,
  };
});

console.log(JSON.stringify({
  totalSeeds: allSignatures.size,
  deterministicRepetitions: difficulties.length * 6,
  reports,
}, null, 2));
