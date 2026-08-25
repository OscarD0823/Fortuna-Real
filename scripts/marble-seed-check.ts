import type { MarbleDifficulty } from "../src/core/types.ts";
import {
  generateMarbleTrack,
  getMarbleMotion,
  marbleDifficultyConfig,
  type MarblePower,
  type MarbleRacer,
  validateMarbleTrack,
} from "../src/games/marbles/marbleRaceEngine.ts";
import { MARBLE_TRACK_PIECE_SPECS } from "../src/games/marbles/marbleTrackPieceKit.ts";

const difficulties: MarbleDifficulty[] = ["easy", "medium", "hard"];
const seedsPerDifficulty = 120;
const allSignatures = new Set<string>();
const motionPowers: readonly MarblePower[] = ["boost", "shield", "freeze", "reverse", "giant", "tiny", "restart"];
const reversingPowers = new Set<MarblePower>(["reverse", "restart"]);
const motionPowerPositions = [0.12, 0.48, 0.89] as const;
const motionSamples = 5_000;
const monotonicTolerance = 0.000001;
const maximumContinuousStep = 0.015;
const pieceSpecifications = Object.entries(MARBLE_TRACK_PIECE_SPECS);
if (
  pieceSpecifications.length !== 10
  || pieceSpecifications.some(([, spec]) => (
    spec.nominalLength < 1.8
    || spec.maximumHeight <= 0
    || spec.shoulder < 0.25
    || spec.description.length < 12
  ))
) {
  throw new Error("El kit visual de pista no contiene diez piezas modulares con dimensiones válidas.");
}

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

const verifyMotionContracts = () => {
  const failures: string[] = [];
  let checkedSamples = 0;
  let checkedScenarios = 0;

  difficulties.forEach((difficulty) => {
    const track = generateMarbleTrack(`fortuna-motion-${difficulty}`, difficulty);

    motionPowers.forEach((power, powerIndex) => {
      motionPowerPositions.forEach((powerAt, positionIndex) => {
        const durationMs = 20_000;
        const racer: MarbleRacer = {
          id: `motion-${difficulty}-${power}-${positionIndex}`,
          number: powerIndex + 1,
          participant: {
            id: `participant-${powerIndex + 1}`,
            name: `Prueba ${power}`,
            color: "#ffffff",
          },
          color: "#ffffff",
          accent: "#000000",
          durationMs,
          power,
          powerAt,
          lane: 0,
          previousWinner: false,
        };
        let previous = getMarbleMotion(racer, track, 0);
        let activeSamples = previous.powerActive ? 1 : 0;
        let scenarioFailed = false;

        for (let sample = 1; sample <= motionSamples; sample += 1) {
          const elapsedMs = durationMs * sample / motionSamples;
          const motion = getMarbleMotion(racer, track, elapsedMs);
          checkedSamples += 1;
          if (motion.powerActive) activeSamples += 1;

          const numericValues = [
            motion.raw,
            motion.progress,
            motion.velocity,
            motion.lateralImpulse,
            motion.verticalOffset,
            motion.spinAngle,
            motion.radiusScale,
          ];
          const progressDelta = motion.progress - previous.progress;
          const reversalAllowed = reversingPowers.has(power);

          let reason = "";
          if (!numericValues.every(Number.isFinite)) {
            reason = "produjo un valor no finito";
          } else if (motion.raw < 0 || motion.raw > 1 || motion.progress < 0 || motion.progress > 1) {
            reason = `sali\u00f3 del rango [0,1] (raw=${motion.raw}, progress=${motion.progress})`;
          } else if (motion.raw + monotonicTolerance < previous.raw) {
            reason = `retrocedi\u00f3 el tiempo normalizado (${previous.raw} -> ${motion.raw})`;
          } else if (!reversalAllowed && progressDelta < -monotonicTolerance) {
            reason = `retrocedi\u00f3 fuera del contrato (${previous.progress} -> ${motion.progress})`;
          } else if (
            reversalAllowed
            && progressDelta < -monotonicTolerance
            && !previous.powerActive
            && !motion.powerActive
          ) {
            reason = `retrocedi\u00f3 fuera de la ventana del poder (${previous.progress} -> ${motion.progress})`;
          } else if (Math.abs(progressDelta) > maximumContinuousStep) {
            reason = `tuvo un salto discontinuo de ${progressDelta}`;
          } else if (sample < motionSamples && motion.finished) {
            reason = `termin\u00f3 antes de durationMs (${elapsedMs}ms)`;
          } else if (motion.verticalOffset < 0 || motion.radiusScale <= 0) {
            reason = `produjo geometr\u00eda inv\u00e1lida (vertical=${motion.verticalOffset}, radius=${motion.radiusScale})`;
          }

          if (reason && !scenarioFailed) {
            failures.push(`${difficulty}/${power}@${powerAt}, muestra ${sample}/${motionSamples}: ${reason}.`);
            scenarioFailed = true;
          }
          previous = motion;
        }

        const beforeFinish = getMarbleMotion(racer, track, durationMs - durationMs / motionSamples);
        const atFinish = getMarbleMotion(racer, track, durationMs);
        if (!scenarioFailed && activeSamples === 0) {
          failures.push(`${difficulty}/${power}@${powerAt}: el poder nunca estuvo activo.`);
        } else if (!scenarioFailed && beforeFinish.progress < 1 - maximumContinuousStep) {
          failures.push(`${difficulty}/${power}@${powerAt}: lleg\u00f3 al \u00faltimo frame en ${beforeFinish.progress}, demasiado lejos de meta.`);
        } else if (!scenarioFailed && (!atFinish.finished || atFinish.progress !== 1 || atFinish.raw !== 1)) {
          failures.push(`${difficulty}/${power}@${powerAt}: no lleg\u00f3 exactamente al 100% en durationMs.`);
        }
        checkedScenarios += 1;
      });
    });
  });

  if (failures.length > 0) {
    throw new Error(`Contrato de movimiento de canicas incumplido:\n- ${failures.slice(0, 24).join("\n- ")}`);
  }

  return {
    scenarios: checkedScenarios,
    samples: checkedSamples,
    powers: motionPowers,
    maximumContinuousStep,
    finishAtDurationMs: true,
  };
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
        && (section.bridgeLift > 0 ? section.clearance <= 0.071 : section.clearance >= 0.069);
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

const motionContracts = verifyMotionContracts();

console.log(JSON.stringify({
  totalSeeds: allSignatures.size,
  deterministicRepetitions: difficulties.length * 6,
  modularPieceKit: pieceSpecifications.map(([type, spec]) => ({ type, ...spec })),
  motionContracts,
  reports,
}, null, 2));
