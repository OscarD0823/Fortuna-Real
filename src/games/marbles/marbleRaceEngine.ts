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
export type TrackZoneType = "launch" | "turbo" | "turbine" | "ice" | "portal" | "forge" | "gravity" | "royal";

export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackObstacle {
  id: string;
  type: TrackObstacleType;
  progress: number;
  sectionId: string;
  zoneId: string;
  scale: number;
}

export interface TrackPowerZone {
  id: string;
  progress: number;
  color: string;
  power: MarblePower;
  zoneId: string;
  scale: number;
}

export interface TrackSection {
  id: string;
  type: TrackSectionType;
  zoneId: string;
  startPointIndex: number;
  endPointIndex: number;
  startProgress: number;
  endProgress: number;
  difficulty: number;
}

export interface TrackZone {
  id: string;
  type: TrackZoneType;
  label: string;
  color: string;
  startProgress: number;
  endProgress: number;
  centerProgress: number;
  sectionCount: number;
  scale: number;
}

export interface MarbleTrack {
  seed: string;
  signature: string;
  name: string;
  difficulty: MarbleDifficulty;
  points: TrackPoint[];
  sections: TrackSection[];
  zones: TrackZone[];
  obstacles: TrackObstacle[];
  powerZones: TrackPowerZone[];
  checkpoints: number[];
  risk: number;
  trackWidth: number;
  lengthRating: "Corta" | "Larga" | "Extrema";
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
  zoneCount: number;
  completionRate: number;
}

interface DifficultyConfig {
  rows: number;
  sectionCount: number;
  zoneTypes: TrackZoneType[];
  obstacleMin: number;
  obstacleMax: number;
  powerZones: number;
  powerChance: number;
  durationBaseMs: number;
  risk: number;
  trackWidth: number;
  featureScale: number;
  lengthRating: MarbleTrack["lengthRating"];
}

export const marbleDifficultyConfig: Record<MarbleDifficulty, DifficultyConfig> = {
  easy: {
    rows: 3,
    sectionCount: 20,
    zoneTypes: ["launch", "turbo", "turbine", "royal"],
    obstacleMin: 1,
    obstacleMax: 1,
    powerZones: 1,
    powerChance: 0.2,
    durationBaseMs: 9000,
    risk: 1,
    trackWidth: 68,
    featureScale: 0.82,
    lengthRating: "Corta",
  },
  medium: {
    rows: 4,
    sectionCount: 32,
    zoneTypes: ["launch", "turbo", "turbine", "ice", "forge", "royal"],
    obstacleMin: 5,
    obstacleMax: 7,
    powerZones: 5,
    powerChance: 0.58,
    durationBaseMs: 12800,
    risk: 3,
    trackWidth: 76,
    featureScale: 1,
    lengthRating: "Larga",
  },
  hard: {
    rows: 5,
    sectionCount: 44,
    zoneTypes: ["launch", "turbo", "turbine", "ice", "portal", "forge", "gravity", "royal"],
    obstacleMin: 10,
    obstacleMax: 14,
    powerZones: 9,
    powerChance: 0.9,
    durationBaseMs: 17000,
    risk: 5,
    trackWidth: 84,
    featureScale: 1.2,
    lengthRating: "Extrema",
  },
};

const POWER_SEQUENCE: MarblePower[] = ["boost", "shield", "freeze", "reverse", "giant", "tiny", "restart"];
const TRACK_NAMES = ["Fábrica Fortuna", "Circuito Imperial", "Corona Mecánica", "Fundición Real", "Taller de Neón"];
const ZONE_SEQUENCE: Record<TrackZoneType, { label: string; color: string }> = {
  launch: { label: "Compuerta Real", color: "#f6bd35" },
  turbo: { label: "Recta Turbo", color: "#09e0df" },
  turbine: { label: "Núcleo Turbina", color: "#f6bd35" },
  ice: { label: "Cámara Glacial", color: "#8fe9ff" },
  portal: { label: "Enlace Cuántico", color: "#d679ff" },
  forge: { label: "Forja de Martillos", color: "#ef6b45" },
  gravity: { label: "Pozo Gravitatorio", color: "#9c62ff" },
  royal: { label: "Meta Imperial", color: "#f6bd35" },
};
const POWER_COLORS: Record<MarblePower, string> = {
  boost: "#00dff3",
  shield: "#74e46e",
  freeze: "#8fe9ff",
  reverse: "#e45e54",
  giant: "#f6bd35",
  tiny: "#c779ff",
  restart: "#9c62ff",
};

export const powersByDifficulty: Record<MarbleDifficulty, MarblePower[]> = {
  easy: ["boost", "shield"],
  medium: ["boost", "shield", "freeze", "giant", "tiny"],
  hard: POWER_SEQUENCE,
};

const zoneObstacleLibrary: Record<TrackZoneType, TrackObstacleType[]> = {
  launch: ["gate", "bumpers"],
  turbo: ["gate", "bumpers", "boost"],
  turbine: ["spinner", "bumpers", "funnel"],
  ice: ["ice", "gate", "bumpers"],
  portal: ["portal", "gate", "funnel"],
  forge: ["hammer", "spinner", "gate"],
  gravity: ["funnel", "portal", "spinner"],
  royal: ["gate", "bumpers"],
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

const buildRouteAnchors = (random: () => number, rows: number): TrackPoint[] => {
  const anchors: TrackPoint[] = [];
  const top = 0.105;
  const bottom = 0.895;
  const left = 0.075;
  const right = 0.925;
  const anchorsPerRow = 5;

  for (let row = 0; row < rows; row += 1) {
    const direction = row % 2 === 0 ? 1 : -1;
    const baseY = top + (row / (rows - 1)) * (bottom - top);
    for (let column = 0; column < anchorsPerRow; column += 1) {
      if (row > 0 && column === 0) continue;
      const ratio = column / (anchorsPerRow - 1);
      const xRatio = direction === 1 ? ratio : 1 - ratio;
      const isEdge = column === 0 || column === anchorsPerRow - 1;
      anchors.push({
        x: roundPoint(left + xRatio * (right - left) + (isEdge ? 0 : (random() - 0.5) * 0.035)),
        y: roundPoint(baseY + (isEdge ? 0 : (random() - 0.5) * 0.075)),
      });
    }
  }
  return anchors;
};

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );

const sampleRoute = (anchors: readonly TrackPoint[], pointCount: number): TrackPoint[] =>
  Array.from({ length: pointCount }, (_, pointIndex) => {
    if (pointIndex === 0) return anchors[0];
    if (pointIndex === pointCount - 1) return anchors[anchors.length - 1];
    const position = (pointIndex / (pointCount - 1)) * (anchors.length - 1);
    const index = Math.floor(position);
    const local = position - index;
    const first = anchors[Math.max(0, index - 1)];
    const second = anchors[index];
    const third = anchors[Math.min(anchors.length - 1, index + 1)];
    const fourth = anchors[Math.min(anchors.length - 1, index + 2)];
    return {
      x: roundPoint(clamp(catmullRom(first.x, second.x, third.x, fourth.x, local), 0.05, 0.95)),
      y: roundPoint(clamp(catmullRom(first.y, second.y, third.y, fourth.y, local), 0.055, 0.945)),
    };
  });

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
  const candidates = Array.from({ length: Math.max(0, maximum - 4) }, (_, index) => index + 2);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [candidates[index], candidates[selected]] = [candidates[selected], candidates[index]];
  }
  return candidates.slice(0, count).sort((first, second) => first - second);
};

const sectionTypeForZone = (
  zoneType: TrackZoneType,
  index: number,
  random: () => number,
): TrackSectionType => {
  const libraries: Record<TrackZoneType, TrackSectionType[]> = {
    launch: ["straight", "curve"],
    turbo: ["speed-zone", "straight", "s-curve"],
    turbine: ["curve", "funnel", "s-curve"],
    ice: ["ice-zone", "tunnel", "curve"],
    portal: ["split", "tunnel", "curve"],
    forge: ["s-curve", "funnel", "straight"],
    gravity: ["split", "curve", "funnel"],
    royal: ["curve", "straight"],
  };
  const library = libraries[zoneType];
  return library[(index + Math.floor(random() * library.length)) % library.length];
};

const zoneForProgress = (zones: readonly TrackZone[], progress: number) =>
  zones.find((zone) => progress >= zone.startProgress && progress <= zone.endProgress) ?? zones[zones.length - 1];

export const generateMarbleTrack = (
  seed: string,
  difficulty: MarbleDifficulty = "medium",
): MarbleTrack => {
  const config = marbleDifficultyConfig[difficulty];
  const random = seededRandom(`track-${difficulty}-${seed}`);
  const anchors = buildRouteAnchors(random, config.rows);
  const points = sampleRoute(anchors, config.sectionCount + 1);
  const distances = pointDistances(points);
  const totalDistance = distances[distances.length - 1] || 1;

  const zones: TrackZone[] = config.zoneTypes.map((type, zoneIndex) => {
    const startSection = Math.floor((zoneIndex * config.sectionCount) / config.zoneTypes.length);
    const endSection = Math.max(startSection, Math.floor(((zoneIndex + 1) * config.sectionCount) / config.zoneTypes.length) - 1);
    const metadata = ZONE_SEQUENCE[type];
    const startProgress = distances[startSection] / totalDistance;
    const endProgress = distances[Math.min(points.length - 1, endSection + 1)] / totalDistance;
    return {
      id: `zone-${zoneIndex}-${hashSeed(`${seed}-${type}-${zoneIndex}`).toString(16)}`,
      type,
      label: metadata.label,
      color: metadata.color,
      startProgress,
      endProgress,
      centerProgress: (startProgress + endProgress) / 2,
      sectionCount: endSection - startSection + 1,
      scale: config.featureScale * (0.9 + random() * 0.18),
    };
  });

  const sections: TrackSection[] = points.slice(1).map((_, index) => {
    const progress = ((distances[index] + distances[index + 1]) / 2) / totalDistance;
    const zone = zoneForProgress(zones, progress);
    const type: TrackSectionType = index === 0
      ? "start"
      : index === points.length - 2
        ? "finish"
        : sectionTypeForZone(zone.type, index, random);
    return {
      id: `section-${index}-${hashSeed(`${seed}-${index}`).toString(16)}`,
      type,
      zoneId: zone.id,
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
    const progress = section.startProgress + (section.endProgress - section.startProgress) * (0.35 + random() * 0.3);
    const zone = zoneForProgress(zones, progress);
    const library = zoneObstacleLibrary[zone.type];
    return {
      id: `obstacle-${index}-${hashSeed(`${seed}-o-${index}`).toString(16)}`,
      type: library[Math.floor(random() * library.length)],
      progress,
      sectionId: section.id,
      zoneId: zone.id,
      scale: config.featureScale * (0.86 + random() * 0.23),
    } satisfies TrackObstacle;
  });

  const zoneIndexes = pickSpreadIndexes(config.powerZones, sections.length, random);
  const availablePowers = powersByDifficulty[difficulty];
  const powerZones = zoneIndexes.map((sectionIndex, index) => {
    const section = sections[sectionIndex];
    const progress = section.startProgress + (section.endProgress - section.startProgress) * 0.72;
    const zone = zoneForProgress(zones, progress);
    const power = availablePowers[(index + Math.floor(random() * availablePowers.length)) % availablePowers.length];
    return {
      id: `power-${index}-${hashSeed(`${seed}-p-${index}`).toString(16)}`,
      progress,
      color: POWER_COLORS[power],
      power,
      zoneId: zone.id,
      scale: config.featureScale * (0.9 + random() * 0.2),
    };
  });
  const checkpoints = zones.slice(0, -1).map((zone) => zone.endProgress);
  const signature = `${difficulty}-${hashSeed(`${seed}-${points.map((point) => `${point.x},${point.y}`).join("|")}`).toString(36)}`;

  return {
    seed,
    signature,
    name: TRACK_NAMES[Math.floor(random() * TRACK_NAMES.length)],
    difficulty,
    points,
    sections,
    zones,
    obstacles,
    powerZones,
    checkpoints,
    risk: config.risk,
    trackWidth: config.trackWidth,
    lengthRating: config.lengthRating,
  };
};

const powerDurationModifier: Record<MarblePower, number> = {
  boost: -720,
  shield: -220,
  freeze: 820,
  reverse: 680,
  giant: 260,
  tiny: -190,
  restart: 1150,
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
    const powerZone = hasPower ? track.powerZones[Math.floor(random() * track.powerZones.length)] : null;
    const power = powerZone?.power ?? null;
    const hue = (index * 137.508 + random() * 38) % 360;
    const trapVariance = track.obstacles.length * (40 + random() * 42);
    return {
      id: `marble-${participant.id}`,
      number: index + 1,
      participant,
      color: participant.color,
      accent: `hsl(${hue} 86% 67%)`,
      durationMs: config.durationBaseMs + random() * 2700 + trapVariance + (power ? powerDurationModifier[power] : 0) + index / 1000,
      power,
      powerAt: powerZone ? clamp(powerZone.progress + (random() - 0.5) * 0.025, 0.08, 0.92) : 2,
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
    ? 1.72
    : racer.power === "tiny" && powerActive
      ? 0.54
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
  const inBounds = track.points.every((point) => point.x >= 0.045 && point.x <= 0.955 && point.y >= 0.05 && point.y <= 0.95);
  const connected = track.sections.every((section, index) =>
    section.startPointIndex === index && section.endPointIndex === index + 1 && section.endProgress > section.startProgress,
  );
  const correctStructure =
    track.sections.length === config.sectionCount &&
    track.zones.length === config.zoneTypes.length &&
    track.powerZones.length === config.powerZones &&
    track.obstacles.length >= config.obstacleMin &&
    track.obstacles.length <= config.obstacleMax;
  return {
    valid: inBounds && connected && correctStructure,
    connected,
    inBounds,
    sectionCount: track.sections.length,
    zoneCount: track.zones.length,
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

export const zoneLabels: Record<TrackZoneType, string> = Object.fromEntries(
  Object.entries(ZONE_SEQUENCE).map(([key, value]) => [key, value.label]),
) as Record<TrackZoneType, string>;
