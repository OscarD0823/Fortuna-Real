import type { MarbleDifficulty } from "../src/core/types.ts";
import {
  generateMarbleTrack,
  getMarbleMotion,
  marbleDifficultyConfig,
  prepareMarbleRace,
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
  let recoverySamples = 0;
  let maximumTurboInstability = 0;

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
          powerTargetId: null,
          incomingPower: null,
          incomingPowerAt: 2,
          incomingPowerSourceId: null,
          comebackChance: 0.5,
          recoveryAt: 2,
          recoveryDirection: 1,
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
          if (power === "boost" && motion.powerActive) {
            maximumTurboInstability = Math.max(maximumTurboInstability, Math.abs(motion.lateralImpulse));
          }

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

    const recoveryDurationMs = 22_000;
    const recoveryRacer: MarbleRacer = {
      id: `recovery-${difficulty}`,
      number: 99,
      participant: { id: `recovery-participant-${difficulty}`, name: "Prueba rescate", color: "#ff793d" },
      color: "#ff793d",
      accent: "#ffb04c",
      durationMs: recoveryDurationMs,
      power: "boost",
      powerAt: 0.2,
      powerTargetId: null,
      incomingPower: null,
      incomingPowerAt: 2,
      incomingPowerSourceId: null,
      comebackChance: 0.9,
      recoveryAt: 0.48,
      recoveryDirection: -1,
      lane: 0,
      previousWinner: false,
    };
    let previousRecovery = getMarbleMotion(recoveryRacer, track, 0);
    let sawRecovery = false;
    let sawVisibleDrop = false;
    let sawReturnNearStart = false;
    for (let sample = 1; sample <= motionSamples; sample += 1) {
      const motion = getMarbleMotion(recoveryRacer, track, recoveryDurationMs * sample / motionSamples);
      const delta = motion.progress - previousRecovery.progress;
      if (motion.recovering) {
        sawRecovery = true;
        recoverySamples += 1;
        if (motion.recoveryDrop > 0.25 && Math.abs(motion.lateralImpulse) > 1) sawVisibleDrop = true;
      }
      if (sawRecovery && motion.progress < 0.035) sawReturnNearStart = true;
      if (Math.abs(delta) > maximumContinuousStep) {
        failures.push(`${difficulty}/rescate, muestra ${sample}/${motionSamples}: salto discontinuo de ${delta}.`);
        break;
      }
      previousRecovery = motion;
    }
    const recoveryFinish = getMarbleMotion(recoveryRacer, track, recoveryDurationMs);
    if (!sawRecovery || !sawVisibleDrop || !sawReturnNearStart || !recoveryFinish.finished || recoveryFinish.progress !== 1) {
      failures.push(`${difficulty}/rescate: no completó caída visible, retorno al inicio y llegada final.`);
    }
    checkedScenarios += 1;
  });

  if (failures.length > 0) {
    throw new Error(`Contrato de movimiento de canicas incumplido:\n- ${failures.slice(0, 24).join("\n- ")}`);
  }
  if (maximumTurboInstability < 1.8) {
    throw new Error(`Turbo no produce suficiente descontrol lateral (${maximumTurboInstability}).`);
  }

  return {
    scenarios: checkedScenarios,
    samples: checkedSamples,
    powers: motionPowers,
    recoverySamples,
    maximumTurboInstability: round(maximumTurboInstability),
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
  const eventTypes = new Set<string>();
  const elevationPeaks: number[] = [];
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
    const elevationPeak = Math.max(...track.points.map((point) => point.elevation ?? 0));
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
      || track.events.length !== config.eventCount
      || track.mapScale !== config.mapScale
      || track.events.some((event) => event.startProgress >= event.endProgress || event.intensity <= 0)
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
    track.events.forEach((event) => eventTypes.add(event.type));
    signatures.add(track.signature);
    allSignatures.add(track.signature);
    coverages.push(coverage);
    bridgeCounts.push(bridges);
    elevationPeaks.push(elevationPeak);
    pointCounts.push(track.points.length);
    if (sampleSeeds.length < 4 && index % 29 === 0) {
      sampleSeeds.push({ seed, signature: track.signature, coverage: round(coverage), bridges });
    }
  }

  if (Object.values(starts).slice(0, 4).some((count) => count === 0)) {
    throw new Error(`La dificultad ${difficulty} no utilizó los cuatro bordes de salida.`);
  }
  const expectedEventTypes = difficulty === "easy" ? 2 : 4;
  if (eventTypes.size < expectedEventTypes) {
    throw new Error(`La dificultad ${difficulty} no generó suficiente variedad de eventos (${eventTypes.size}/${expectedEventTypes}).`);
  }

  return {
    difficulty,
    seeds: signatures.size,
    modulesUsed: modules.size,
    mapScale: config.mapScale,
    eventCount: config.eventCount,
    eventTypes: [...eventTypes].sort(),
    maximumElevation: round(Math.max(...elevationPeaks)),
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

const finishRuleParticipants = [
  { id: "finish-a", name: "Ana", color: "#09e0df" },
  { id: "finish-b", name: "Bruno", color: "#f6bd35" },
  { id: "finish-c", name: "Carla", color: "#ef6b45" },
];
const firstRuleRace = prepareMarbleRace(finishRuleParticipants, "direct", "finish-rule-proof", "medium", new Set(), "first");
const lastRuleRace = prepareMarbleRace(finishRuleParticipants, "direct", "finish-rule-proof", "medium", new Set(), "last");
if (
  firstRuleRace.selected.durationMs !== Math.min(...firstRuleRace.racers.map((racer) => racer.durationMs))
  || lastRuleRace.selected.durationMs !== Math.max(...lastRuleRace.racers.map((racer) => racer.durationMs))
  || firstRuleRace.selected.id === lastRuleRace.selected.id
) {
  throw new Error("La regla Primero/Último no selecciona los extremos reales de la carrera.");
}

const motionContracts = verifyMotionContracts();

for (let index = 1; index < difficulties.length; index += 1) {
  const previous = marbleDifficultyConfig[difficulties[index - 1]];
  const current = marbleDifficultyConfig[difficulties[index]];
  if (
    current.sectionCount <= previous.sectionCount
    || current.obstacleMin <= previous.obstacleMin
    || current.eventCount <= previous.eventCount
    || current.mapScale <= previous.mapScale
    || current.maximumElevation <= previous.maximumElevation
    || current.maximumBridgeLift <= previous.maximumBridgeLift
    || current.durationBaseMs <= previous.durationBaseMs
  ) {
    throw new Error(`La dificultad ${difficulties[index]} no aumenta todas las dimensiones de la carrera.`);
  }
}

console.log(JSON.stringify({
  totalSeeds: allSignatures.size,
  deterministicRepetitions: difficulties.length * 6,
  modularPieceKit: pieceSpecifications.map(([type, spec]) => ({ type, ...spec })),
  motionContracts,
  finishRules: { first: firstRuleRace.selected.number, last: lastRuleRace.selected.number },
  reports,
}, null, 2));
