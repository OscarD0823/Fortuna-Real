import type { DrawMode, MarbleDifficulty, Participant } from "../../core/types";

export type MarblePower = "boost" | "shield" | "freeze" | "reverse" | "giant" | "tiny" | "restart";
export type TrackObstacleType = "spinner" | "bumpers" | "gate" | "boost" | "ice" | "portal" | "hammer" | "funnel";
export type TrackSectionType =
  | "start"
  | "straight"
  | "curve"
  | "s-curve"
  | "tunnel"
  | "funnel"
  | "split"
  | "speed-zone"
  | "ice-zone"
  | "finish";

export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackObstacle {
  id: string;
  type: TrackObstacleType;
  progress: number;
  sectionId: string;
}

export interface TrackPowerZone {
  id: string;
  progress: number;
  color: string;
}

export interface TrackSection {
  id: string;
  type: TrackSectionType;
  startPointIndex: number;
  endPointIndex: number;
  startProgress: number;
  endProgress: number;
  difficulty: number;
}

export interface MarbleTrack {
  seed: string;
  signature: string;
  name: string;
  difficulty: MarbleDifficulty;
  points: TrackPoint[];
  sections: TrackSection[];
  obstacles: TrackObstacle[];
  powerZones: TrackPowerZone[];
  checkpoints: number[];
  risk: number;
}

export interface MarbleRacer {
  id: string;
  number: number;
  participant: Participant;
  color: string;
  accent: string;
  durationMs: number;
  power: MarblePower | null;
  powerAt: number;
  lane: number;
}

export interface PreparedMarbleRace {
  track: MarbleTrack;
  racers: MarbleRacer[];
  selected: MarbleRacer;
  mode: DrawMode;
  difficulty: MarbleDifficulty;
}

export interface TrackValidationResult {
  valid: boolean;
  connected: boolean;
  inBounds: boolean;
  sectionCount: number;
  completionRate: number;
}

interface DifficultyConfig {
  rows: number;
  pointsPerRow: number;
  obstacleMin: number;
  obstacleMax: number;
  powerZones: number;
  powerChance: number;
  durationBaseMs: number;
  risk: number;
}

export const marbleDifficultyConfig: Record<MarbleDifficulty, DifficultyConfig> = {
  easy: {
    rows: 3,
    pointsPerRow: 3,
    obstacleMin: 1,
    obstacleMax: 2,
    powerZones: 1,
    powerChance: 0.16,
    durationBaseMs: 5900,
    risk: 1,
  },
  medium: {
    rows: 4,
    pointsPerRow: 4,
    obstacleMin: 4,
    obstacleMax: 6,
    powerZones: 4,
    powerChance: 0.52,
    durationBaseMs: 7600,
    risk: 3,
  },
  hard: {
    rows: 5,
    pointsPerRow: 5,
    obstacleMin: 8,
    obstacleMax: 10,
    powerZones: 7,
    powerChance: 0.86,
    durationBaseMs: 9800,
    risk: 5,
  },
};

const POWER_SEQUENCE: MarblePower[] = ["boost", "shield", "freeze", "reverse", "giant", "tiny", "restart"];
const TRACK_NAMES = ["Fábrica Fortuna", "Circuito Imperial", "Corona Mecánica", "Fundición Real", "Taller de Neón"];
const POWER_COLORS = ["#00dff3", "#74e46e", "#8fe9ff", "#e45e54", "#f6bd35", "#c779ff", "#9c62ff"];

export const powersByDifficulty: Record<MarbleDifficulty, MarblePower[]> = {
  easy: ["boost", "shield"],
  medium: ["boost", "shield", "freeze", "giant", "tiny"],
  hard: POWER_SEQUENCE,
};

const obstacleLibrary: Record<MarbleDifficulty, TrackObstacleType[]> = {
  easy: ["bumpers", "gate", "boost"],
  medium: ["spinner", "bumpers", "gate", "boost", "ice", "funnel"],
  hard: ["spinner", "bumpers", "gate", "boost", "ice", "portal", "hammer", "funnel"],
};

const sectionLibrary: Record<MarbleDifficulty, TrackSectionType[]> = {
  easy: ["straight", "curve", "s-curve"],
  medium: ["straight", "curve", "s-curve", "tunnel", "funnel", "speed-zone"],
  hard: ["straight", "curve", "s-curve", "tunnel", "funnel", "split", "speed-zone", "ice-zone"],
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededRandom = (seed: string) => {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const roundPoint = (value: number) => Math.round(value * 10000) / 10000;

export const createMarbleSeed = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildModularRoute = (random: () => number, config: DifficultyConfig): TrackPoint[] => {
  const points: TrackPoint[] = [];
  const top = 0.12;
  const bottom = 0.88;
  const left = 0.09;
  const right = 0.91;

  for (let row = 0; row < config.rows; row += 1) {
    const direction = row % 2 === 0 ? 1 : -1;
    const baseY = top + (row / (config.rows - 1)) * (bottom - top);
    const rowPoints = Array.from({ length: config.pointsPerRow }, (_, column) => {
      const ratio = column / (config.pointsPerRow - 1);
      const xRatio = direction === 1 ? ratio : 1 - ratio;
      const isEdge = column === 0 || column === config.pointsPerRow - 1;
      return {
        x: roundPoint(left + xRatio * (right - left)),
        y: roundPoint(clamp(baseY + (isEdge ? 0 : (random() - 0.5) * 0.07), 0.08, 0.92)),
      };
    });

    if (row === 0) {
      points.push(...rowPoints);
      continue;
    }

    const rowStart = rowPoints[0];
    const previous = points[points.length - 1];
    points.push({
      x: roundPoint(clamp(previous.x + (direction === 1 ? -1 : 1) * (0.045 + random() * 0.025), 0.045, 0.955)),
      y: roundPoint((previous.y + rowStart.y) / 2 + (random() - 0.5) * 0.025),
    });
    points.push(...rowPoints.slice(1));
  }

  return points;
};

const distanceCache = new WeakMap<readonly TrackPoint[], number[]>();

const pointDistances = (points: readonly TrackPoint[]) => {
  const cached = distanceCache.get(points);
  if (cached) return cached;
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    distances.push(distances[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
  }
  distanceCache.set(points, distances);
  return distances;
};

const pickSpreadIndexes = (count: number, maximum: number, random: () => number) => {
  const candidates = Array.from({ length: Math.max(0, maximum - 2) }, (_, index) => index + 1);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [candidates[index], candidates[selected]] = [candidates[selected], candidates[index]];
  }
  return candidates.slice(0, count).sort((first, second) => first - second);
};

export const generateMarbleTrack = (
  seed: string,
  difficulty: MarbleDifficulty = "medium",
): MarbleTrack => {
  const config = marbleDifficultyConfig[difficulty];
  const random = seededRandom(`track-${difficulty}-${seed}`);
  const points = buildModularRoute(random, config);
  const distances = pointDistances(points);
  const totalDistance = distances[distances.length - 1] || 1;
  const sections: TrackSection[] = points.slice(1).map((point, index) => {
    const start = points[index];
    const deltaX = point.x - start.x;
    const deltaY = point.y - start.y;
    const isTurn = Math.abs(deltaY) > Math.abs(deltaX) * 0.65;
    const library = sectionLibrary[difficulty];
    const randomType = library[Math.floor(random() * library.length)];
    const type: TrackSectionType = index === 0
      ? "start"
      : index === points.length - 2
        ? "finish"
        : isTurn
          ? "curve"
          : randomType;
    return {
      id: `section-${index}-${hashSeed(`${seed}-${index}`).toString(16)}`,
      type,
      startPointIndex: index,
      endPointIndex: index + 1,
      startProgress: distances[index] / totalDistance,
      endProgress: distances[index + 1] / totalDistance,
      difficulty: type === "split" || type === "funnel" || type === "ice-zone" ? 3 : type === "tunnel" || type === "speed-zone" ? 2 : 1,
    };
  });

  const obstacleCount = config.obstacleMin + Math.floor(random() * (config.obstacleMax - config.obstacleMin + 1));
  const obstacleIndexes = pickSpreadIndexes(obstacleCount, sections.length, random);
  const obstacles = obstacleIndexes.map((sectionIndex, index) => {
    const section = sections[sectionIndex];
    const library = obstacleLibrary[difficulty];
    return {
      id: `obstacle-${index}-${hashSeed(`${seed}-o-${index}`).toString(16)}`,
      type: library[Math.floor(random() * library.length)],
      progress: section.startProgress + (section.endProgress - section.startProgress) * (0.35 + random() * 0.3),
      sectionId: section.id,
    } satisfies TrackObstacle;
  });

  const zoneIndexes = pickSpreadIndexes(config.powerZones, sections.length, random);
  const powerZones = zoneIndexes.map((sectionIndex, index) => {
    const section = sections[sectionIndex];
    return {
      id: `power-${index}-${hashSeed(`${seed}-p-${index}`).toString(16)}`,
      progress: section.startProgress + (section.endProgress - section.startProgress) * 0.72,
      color: POWER_COLORS[(index + Math.floor(random() * POWER_COLORS.length)) % POWER_COLORS.length],
    };
  });
  const checkpointCount = difficulty === "easy" ? 4 : difficulty === "medium" ? 6 : 8;
  const checkpoints = Array.from({ length: checkpointCount }, (_, index) => (index + 1) / (checkpointCount + 1));
  const signature = `${difficulty}-${hashSeed(`${seed}-${points.map((point) => `${point.x},${point.y}`).join("|")}`).toString(36)}`;

  return {
    seed,
    signature,
    name: TRACK_NAMES[Math.floor(random() * TRACK_NAMES.length)],
    difficulty,
    points,
    sections,
    obstacles,
    powerZones,
    checkpoints,
    risk: config.risk,
  };
};

const powerDurationModifier: Record<MarblePower, number> = {
  boost: -620,
  shield: -180,
  freeze: 720,
  reverse: 560,
  giant: 210,
  tiny: -160,
  restart: 980,
};

export const prepareMarbleRace = (
  participants: readonly Participant[],
  mode: DrawMode,
  seed: string,
  difficulty: MarbleDifficulty = "medium",
): PreparedMarbleRace => {
  if (participants.length < 2) throw new Error("La carrera necesita al menos dos participantes.");
  const track = generateMarbleTrack(seed, difficulty);
  const config = marbleDifficultyConfig[difficulty];
  const random = seededRandom(`racers-${difficulty}-${seed}-${participants.map((person) => person.id).join("|")}`);
  const racers = participants.map((participant, index) => {
    const hasPower = random() < config.powerChance;
    const availablePowers = powersByDifficulty[difficulty];
    const power = hasPower ? availablePowers[Math.floor(random() * availablePowers.length)] : null;
    const hue = (index * 137.508 + random() * 38) % 360;
    const zone = track.powerZones[Math.floor(random() * track.powerZones.length)];
    const trapVariance = track.obstacles.length * (35 + random() * 35);
    return {
      id: `marble-${participant.id}`,
      number: index + 1,
      participant,
      color: participant.color,
      accent: `hsl(${hue} 86% 67%)`,
      durationMs: config.durationBaseMs + random() * 2300 + trapVariance + (power ? powerDurationModifier[power] : 0) + index / 1000,
      power,
      powerAt: power && zone ? clamp(zone.progress + (random() - 0.5) * 0.035, 0.12, 0.88) : 2,
      lane: random() * 2 - 1,
    } satisfies MarbleRacer;
  });
  const selected = mode === "direct"
    ? racers.reduce((best, racer) => racer.durationMs < best.durationMs ? racer : best)
    : racers.reduce((last, racer) => racer.durationMs > last.durationMs ? racer : last);

  return { track, racers, selected, mode, difficulty };
};

const smoothStep = (value: number) => value * value * (3 - 2 * value);

export const getMarbleProgress = (racer: MarbleRacer, elapsedMs: number) => {
  const raw = clamp(elapsedMs / racer.durationMs, 0, 1);
  const at = racer.powerAt;
  let progress = smoothStep(raw);

  if (racer.power === "boost" && raw >= at && raw <= at + 0.18) {
    progress += Math.sin(((raw - at) / 0.18) * Math.PI) * 0.055;
  } else if (racer.power === "freeze" && raw >= at && raw <= at + 0.1) {
    progress = smoothStep(at) + (raw - at) * 0.03;
  } else if (racer.power === "reverse" && raw >= at && raw <= at + 0.12) {
    progress -= Math.sin(((raw - at) / 0.12) * Math.PI) * 0.07;
  } else if (racer.power === "restart" && raw >= at && raw <= at + 0.13) {
    const local = (raw - at) / 0.13;
    progress = smoothStep(at) * (1 - local) + 0.025 * local;
  }

  const powerActive = racer.power !== null && raw >= at && raw <= at + 0.115;
  const radiusScale = racer.power === "giant" && powerActive
    ? 1.65
    : racer.power === "tiny" && powerActive
      ? 0.58
      : 1;

  return {
    raw,
    progress: clamp(raw >= 1 ? 1 : progress, 0, 0.999),
    powerActive,
    radiusScale,
    finished: raw >= 1,
  };
};

export const getTrackPosition = (points: readonly TrackPoint[], progress: number) => {
  const distances = pointDistances(points);
  const target = clamp(progress, 0, 1) * distances[distances.length - 1];
  let index = 0;
  while (index < distances.length - 2 && distances[index + 1] < target) index += 1;
  const start = points[index];
  const end = points[index + 1];
  const sectionLength = distances[index + 1] - distances[index] || 1;
  const local = clamp((target - distances[index]) / sectionLength, 0, 1);
  const x = start.x + (end.x - start.x) * local;
  const y = start.y + (end.y - start.y) * local;
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  return { x, y, tangentX: (end.x - start.x) / length, tangentY: (end.y - start.y) / length };
};

export const validateMarbleTrack = (track: MarbleTrack): TrackValidationResult => {
  const config = marbleDifficultyConfig[track.difficulty];
  const inBounds = track.points.every((point) => point.x >= 0.04 && point.x <= 0.96 && point.y >= 0.04 && point.y <= 0.96);
  const connected = track.sections.every((section, index) =>
    section.startPointIndex === index && section.endPointIndex === index + 1 && section.endProgress > section.startProgress,
  );
  const enoughSections = track.sections.length >= config.rows * 2;
  return {
    valid: inBounds && connected && enoughSections,
    connected,
    inBounds,
    sectionCount: track.sections.length,
    completionRate: inBounds && connected ? 1 : 0,
  };
};

export const powerLabels: Record<MarblePower, string> = {
  boost: "Turbo",
  shield: "Escudo",
  freeze: "Congelada",
  reverse: "Sentido contrario",
  giant: "Canica gigante",
  tiny: "Canica mini",
  restart: "Regresa al inicio",
};

export const difficultyLabels: Record<MarbleDifficulty, string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};
