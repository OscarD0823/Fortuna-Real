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
  /** Altura del centro de la pieza en unidades del escenario 3D. */
  elevation?: number;
  /** Peralte en radianes. Positivo inclina la pieza hacia su lado izquierdo. */
  bank?: number;
}

export type TrackSurface = "steel" | "grip" | "turbo" | "ice" | "mesh";

export interface TrackModuleDefinition {
  id: string;
  type: TrackSectionType;
  surface: TrackSurface;
  speedMultiplier: number;
  surfaceGrip: number;
  elevationBias: number;
  bankStrength: number;
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
  moduleId: string;
  surface: TrackSurface;
  length: number;
  turn: number;
  entryHeading: number;
  exitHeading: number;
  connectorGap: number;
  clearance: number;
  bridgeLift: number;
  bank: number;
  grade: number;
  elevationDelta: number;
  speedMultiplier: number;
  surfaceGrip: number;
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
  previousWinner: boolean;
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

export interface MarbleMotionState {
  raw: number;
  progress: number;
  velocity: number;
  lateralImpulse: number;
  verticalOffset: number;
  spinAngle: number;
  section: TrackSection;
  powerActive: boolean;
  radiusScale: number;
  finished: boolean;
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

/**
 * Piezas reutilizables de la pista. El generador escoge una variante compatible
 * con la zona y después conecta sus extremos sobre el trazado procedural.
 */
export const marbleSectionModuleLibrary: Record<TrackSectionType, readonly TrackModuleDefinition[]> = {
  start: [
    { id: "launch-gate-a", type: "start", surface: "grip", speedMultiplier: 0.86, surfaceGrip: 1.18, elevationBias: -0.015, bankStrength: 0.25 },
  ],
  straight: [
    { id: "steel-straight-a", type: "straight", surface: "steel", speedMultiplier: 1, surfaceGrip: 1, elevationBias: 0.012, bankStrength: 0.72 },
    { id: "steel-straight-b", type: "straight", surface: "mesh", speedMultiplier: 0.97, surfaceGrip: 1.08, elevationBias: -0.008, bankStrength: 0.78 },
  ],
  curve: [
    { id: "banked-curve-a", type: "curve", surface: "grip", speedMultiplier: 0.96, surfaceGrip: 1.16, elevationBias: 0.02, bankStrength: 1.45 },
    { id: "banked-curve-b", type: "curve", surface: "steel", speedMultiplier: 0.93, surfaceGrip: 0.96, elevationBias: -0.012, bankStrength: 1.7 },
  ],
  "s-curve": [
    { id: "serpent-a", type: "s-curve", surface: "grip", speedMultiplier: 0.91, surfaceGrip: 1.2, elevationBias: 0.01, bankStrength: 1.85 },
    { id: "serpent-b", type: "s-curve", surface: "mesh", speedMultiplier: 0.89, surfaceGrip: 1.1, elevationBias: -0.018, bankStrength: 1.7 },
  ],
  tunnel: [
    { id: "tunnel-ribbed-a", type: "tunnel", surface: "grip", speedMultiplier: 0.92, surfaceGrip: 1.15, elevationBias: 0.055, bankStrength: 0.9 },
    { id: "tunnel-drop-b", type: "tunnel", surface: "steel", speedMultiplier: 1.02, surfaceGrip: 0.94, elevationBias: -0.045, bankStrength: 0.82 },
  ],
  funnel: [
    { id: "gravity-funnel-a", type: "funnel", surface: "steel", speedMultiplier: 0.78, surfaceGrip: 0.82, elevationBias: -0.07, bankStrength: 1.35 },
    { id: "gravity-funnel-b", type: "funnel", surface: "mesh", speedMultiplier: 0.82, surfaceGrip: 0.88, elevationBias: -0.045, bankStrength: 1.2 },
  ],
  split: [
    { id: "split-bridge-a", type: "split", surface: "grip", speedMultiplier: 0.86, surfaceGrip: 1.12, elevationBias: 0.075, bankStrength: 1.05 },
    { id: "split-bridge-b", type: "split", surface: "steel", speedMultiplier: 0.9, surfaceGrip: 0.98, elevationBias: 0.05, bankStrength: 1.15 },
  ],
  "speed-zone": [
    { id: "turbo-three-a", type: "speed-zone", surface: "turbo", speedMultiplier: 1.34, surfaceGrip: 1.24, elevationBias: -0.025, bankStrength: 0.75 },
    { id: "turbo-three-b", type: "speed-zone", surface: "turbo", speedMultiplier: 1.27, surfaceGrip: 1.16, elevationBias: 0.018, bankStrength: 0.82 },
  ],
  "ice-zone": [
    { id: "ice-glass-a", type: "ice-zone", surface: "ice", speedMultiplier: 1.09, surfaceGrip: 0.44, elevationBias: -0.025, bankStrength: 0.48 },
    { id: "ice-glass-b", type: "ice-zone", surface: "ice", speedMultiplier: 1.14, surfaceGrip: 0.38, elevationBias: 0.012, bankStrength: 0.42 },
  ],
  finish: [
    { id: "royal-finish-a", type: "finish", surface: "grip", speedMultiplier: 1.03, surfaceGrip: 1.22, elevationBias: -0.02, bankStrength: 0.2 },
  ],
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

interface ModuleGeometryDefinition {
  lengthScale: number;
  turnAmplitude: number;
  sampleCount: number;
  wave: number;
}

const moduleGeometryLibrary: Record<TrackSectionType, ModuleGeometryDefinition> = {
  start: { lengthScale: 1.08, turnAmplitude: 0.06, sampleCount: 5, wave: 0 },
  straight: { lengthScale: 1, turnAmplitude: 0.14, sampleCount: 5, wave: 0 },
  curve: { lengthScale: 0.94, turnAmplitude: 0.62, sampleCount: 7, wave: 0 },
  "s-curve": { lengthScale: 1.08, turnAmplitude: 0.7, sampleCount: 8, wave: 1 },
  tunnel: { lengthScale: 0.96, turnAmplitude: 0.28, sampleCount: 6, wave: 0 },
  funnel: { lengthScale: 0.88, turnAmplitude: 0.5, sampleCount: 7, wave: 0 },
  split: { lengthScale: 1.04, turnAmplitude: 0.38, sampleCount: 7, wave: 0.35 },
  "speed-zone": { lengthScale: 1.2, turnAmplitude: 0.1, sampleCount: 6, wave: 0 },
  "ice-zone": { lengthScale: 1.08, turnAmplitude: 0.34, sampleCount: 7, wave: 0.28 },
  finish: { lengthScale: 1.14, turnAmplitude: 0.05, sampleCount: 5, wave: 0 },
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

const normalizeAngle = (angle: number) => {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
};

const pickSectionModule = (
  type: TrackSectionType,
  index: number,
  random: () => number,
) => {
  const modules = marbleSectionModuleLibrary[type];
  return modules[(index + Math.floor(random() * modules.length)) % modules.length];
};

interface SectionPlan {
  type: TrackSectionType;
  zoneIndex: number;
  definition: TrackModuleDefinition;
}

interface ModuleRange {
  startPointIndex: number;
  endPointIndex: number;
  entryHeading: number;
  exitHeading: number;
  connectorGap: number;
  clearance: number;
}

interface ModuleCandidate {
  points: TrackPoint[];
  exitHeading: number;
  score: number;
  clearance: number;
}

const createStartConnector = (random: () => number) => {
  const edge = Math.floor(random() * 4);
  const offset = 0.16 + random() * 0.68;
  if (edge === 0) return { point: { x: 0.065, y: offset }, heading: 0 };
  if (edge === 1) return { point: { x: offset, y: 0.065 }, heading: Math.PI / 2 };
  if (edge === 2) return { point: { x: 0.935, y: offset }, heading: Math.PI };
  return { point: { x: offset, y: 0.935 }, heading: -Math.PI / 2 };
};

const createProceduralGoals = (
  random: () => number,
  count: number,
  start: TrackPoint,
) => {
  const columns = 4;
  const rows = 3;
  const candidates = Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: 0.12 + (column / (columns - 1)) * 0.76 + (random() - 0.5) * 0.07,
      y: 0.13 + (row / (rows - 1)) * 0.74 + (random() - 0.5) * 0.07,
    };
  });
  const goals: TrackPoint[] = [];
  let cursor = start;
  while (goals.length < count && candidates.length > 0) {
    let selectedIndex = 0;
    let selectedScore = Number.NEGATIVE_INFINITY;
    candidates.forEach((candidate, index) => {
      const distance = Math.hypot(candidate.x - cursor.x, candidate.y - cursor.y);
      const separation = goals.length === 0
        ? distance
        : Math.min(...goals.map((goal) => Math.hypot(candidate.x - goal.x, candidate.y - goal.y)));
      const score = distance * 1.35 + separation * 0.65 + random() * 0.22;
      if (score > selectedScore) {
        selectedScore = score;
        selectedIndex = index;
      }
    });
    cursor = candidates.splice(selectedIndex, 1)[0];
    goals.push(cursor);
  }
  return goals;
};

const traceModule = (
  start: TrackPoint,
  entryHeading: number,
  geometry: ModuleGeometryDefinition,
  length: number,
  totalTurn: number,
  waveDirection: number,
) => {
  const points: TrackPoint[] = [];
  let x = start.x;
  let y = start.y;
  const stepLength = length / geometry.sampleCount;
  for (let sample = 1; sample <= geometry.sampleCount; sample += 1) {
    const local = (sample - 0.5) / geometry.sampleCount;
    const wave = geometry.wave === 0
      ? 0
      : Math.sin(local * Math.PI * 2) * geometry.turnAmplitude * geometry.wave * waveDirection;
    const heading = entryHeading + totalTurn * local + wave;
    x += Math.cos(heading) * stepLength;
    y += Math.sin(heading) * stepLength;
    points.push({ x: roundPoint(x), y: roundPoint(y) });
  }
  return { points, exitHeading: normalizeAngle(entryHeading + totalTurn) };
};

const minimumRouteDistance = (
  candidatePoints: readonly TrackPoint[],
  routePoints: readonly TrackPoint[],
) => {
  const comparisonEnd = Math.max(0, routePoints.length - 10);
  if (comparisonEnd <= 0) return 0.2;
  let minimum = 0.2;
  candidatePoints.forEach((candidate) => {
    for (let index = 0; index < comparisonEnd; index += 3) {
      const point = routePoints[index];
      minimum = Math.min(minimum, Math.hypot(candidate.x - point.x, candidate.y - point.y));
    }
  });
  return minimum;
};

const candidateWithinBoard = (candidate: readonly TrackPoint[]) => candidate.every((point) =>
  point.x >= 0.055 && point.x <= 0.945 && point.y >= 0.055 && point.y <= 0.945,
);

const routeCoverage = (points: readonly TrackPoint[]) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
};

const assembleModuleRoute = (
  plans: readonly SectionPlan[],
  random: () => number,
  goalCount: number,
) => {
  const startConnector = createStartConnector(random);
  const goals = createProceduralGoals(random, goalCount, startConnector.point);
  const points: TrackPoint[] = [{ x: roundPoint(startConnector.point.x), y: roundPoint(startConnector.point.y) }];
  const ranges: ModuleRange[] = [];
  const baseLength = clamp(0.158 - plans.length * 0.0019, 0.068, 0.12);
  let heading = startConnector.heading;

  plans.forEach((plan, sectionIndex) => {
    const geometry = moduleGeometryLibrary[plan.type];
    const start = points[points.length - 1];
    const goalIndex = Math.min(goals.length - 1, Math.floor((sectionIndex / Math.max(1, plans.length - 1)) * goals.length));
    const goal = goals[Math.max(0, goalIndex)] ?? { x: 0.5, y: 0.5 };
    const targetHeading = Math.atan2(goal.y - start.y, goal.x - start.x);
    const targetTurn = normalizeAngle(targetHeading - heading);
    const routeXs = points.map((point) => point.x);
    const routeYs = points.map((point) => point.y);
    const routeMinX = Math.min(...routeXs);
    const routeMaxX = Math.max(...routeXs);
    const routeMinY = Math.min(...routeYs);
    const routeMaxY = Math.max(...routeYs);
    let best: ModuleCandidate | null = null;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const preferredSign = targetTurn === 0 ? (random() > 0.5 ? 1 : -1) : Math.sign(targetTurn);
      const sign = attempt % 4 === 3 ? -preferredSign : preferredSign;
      const curved = plan.type === "curve" || plan.type === "funnel";
      const gentle = plan.type === "straight" || plan.type === "speed-zone" || plan.type === "start" || plan.type === "finish";
      const turnMagnitude = curved
        ? geometry.turnAmplitude * (0.58 + random() * 0.38)
        : gentle
          ? Math.min(geometry.turnAmplitude, Math.abs(targetTurn))
          : clamp(Math.abs(targetTurn) * 0.55 + random() * geometry.turnAmplitude * 0.35, 0.06, geometry.turnAmplitude * 0.72);
      const totalTurn = clamp(
        (curved ? sign * turnMagnitude : Math.sign(targetTurn || sign) * turnMagnitude) + (random() - 0.5) * 0.055,
        -geometry.turnAmplitude,
        geometry.turnAmplitude,
      );
      const length = baseLength * geometry.lengthScale * (0.84 + random() * 0.24);
      const traced = traceModule(start, heading, geometry, length, totalTurn, attempt % 2 === 0 ? 1 : -1);
      if (!candidateWithinBoard(traced.points)) continue;
      const endpoint = traced.points[traced.points.length - 1];
      const clearance = minimumRouteDistance(traced.points, points);
      if (clearance < 0.026) continue;
      const margin = Math.min(endpoint.x - 0.055, 0.945 - endpoint.x, endpoint.y - 0.055, 0.945 - endpoint.y);
      const goalDistance = Math.hypot(endpoint.x - goal.x, endpoint.y - goal.y);
      const alignment = Math.abs(normalizeAngle(traced.exitHeading - targetHeading));
      const coverageWidth = Math.max(routeMaxX, endpoint.x) - Math.min(routeMinX, endpoint.x);
      const coverageHeight = Math.max(routeMaxY, endpoint.y) - Math.min(routeMinY, endpoint.y);
      const coverageScore = coverageWidth * coverageHeight * 1.8 + Math.min(coverageWidth, coverageHeight) * 1.1;
      const score = Math.min(0.2, clearance) * 8.5
        + Math.min(0.18, margin) * 2.8
        + coverageScore
        - goalDistance * 3.7
        - alignment * 0.58
        + random() * 0.08;
      if (!best || score > best.score) best = { ...traced, score, clearance };
    }

    if (!best) {
      const centerHeading = Math.atan2(0.5 - start.y, 0.5 - start.x);
      const safeTurn = clamp(normalizeAngle(centerHeading - heading), -geometry.turnAmplitude, geometry.turnAmplitude);
      for (let shrink = 0; shrink < 5 && !best; shrink += 1) {
        const traced = traceModule(
          start,
          heading,
          geometry,
          baseLength * geometry.lengthScale * (0.72 - shrink * 0.1),
          safeTurn,
          shrink % 2 === 0 ? 1 : -1,
        );
        if (candidateWithinBoard(traced.points)) {
          best = { ...traced, score: -100, clearance: minimumRouteDistance(traced.points, points) };
        }
      }
    }

    if (!best) {
      // Último recurso determinista: un conector corto hacia el centro. Nunca deja
      // una pieza abierta, incluso si el caminante procedural se encierra.
      const safeHeading = Math.atan2(0.5 - start.y, 0.5 - start.x);
      const traced = traceModule(start, safeHeading, moduleGeometryLibrary.straight, 0.028, 0, 1);
      best = { ...traced, score: -200, clearance: minimumRouteDistance(traced.points, points) };
    }

    const startPointIndex = points.length - 1;
    points.push(...best.points);
    const endPointIndex = points.length - 1;
    ranges.push({
      startPointIndex,
      endPointIndex,
      entryHeading: heading,
      exitHeading: best.exitHeading,
      connectorGap: 0,
      clearance: best.clearance,
    });
    heading = best.exitHeading;
  });

  return { points, ranges };
};

interface SectionDraft {
  id: string;
  type: TrackSectionType;
  zoneId: string;
  startPointIndex: number;
  endPointIndex: number;
  startProgress: number;
  endProgress: number;
  difficulty: number;
  definition: TrackModuleDefinition;
  length: number;
  turn: number;
  entryHeading: number;
  exitHeading: number;
  connectorGap: number;
  clearance: number;
}

const buildVerticalProfile = (
  drafts: readonly SectionDraft[],
  random: () => number,
  difficulty: MarbleDifficulty,
) => {
  const variation = difficulty === "easy" ? 0.025 : difficulty === "medium" ? 0.046 : 0.065;
  const maximumElevation = difficulty === "easy" ? 0.36 : difficulty === "medium" ? 0.68 : 0.92;
  const rawElevations = [0];
  let elevation = 0;
  drafts.forEach((draft, index) => {
    const remaining = Math.max(1, drafts.length - index);
    const returnBias = -elevation / remaining;
    const curveLift = Math.abs(draft.turn) * (difficulty === "hard" ? 0.035 : 0.02);
    const change = draft.definition.elevationBias
      + curveLift
      + (random() - 0.5) * variation
      + returnBias * 0.34;
    elevation += clamp(change, -0.11, 0.12);
    rawElevations.push(elevation);
  });

  // Los conectores inicial y final quedan a la misma altura, de modo que cualquier
  // conjunto de piezas se pueda sustituir por otro sin abrir una grieta en la pista.
  const drift = rawElevations[rawElevations.length - 1];
  const leveled = rawElevations.map((value, index) => value - drift * (index / drafts.length));
  const range = Math.max(...leveled.map((value) => Math.abs(value)), 0.001);
  const scale = range > maximumElevation ? maximumElevation / range : 1;
  return leveled.map((value) => roundPoint(value * scale));
};

export const generateMarbleTrack = (
  seed: string,
  difficulty: MarbleDifficulty = "medium",
): MarbleTrack => {
  const config = marbleDifficultyConfig[difficulty];
  const random = seededRandom(`track-${difficulty}-${seed}`);
  const plans: SectionPlan[] = Array.from({ length: config.sectionCount }, (_, index) => {
    const zoneIndex = Math.min(
      config.zoneTypes.length - 1,
      Math.floor((index * config.zoneTypes.length) / config.sectionCount),
    );
    const type: TrackSectionType = index === 0
      ? "start"
      : index === config.sectionCount - 1
        ? "finish"
        : sectionTypeForZone(config.zoneTypes[zoneIndex], index, random);
    return { type, zoneIndex, definition: pickSectionModule(type, index, random) };
  });
  let assembly = assembleModuleRoute(plans, random, config.rows + 2);
  for (let attempt = 1; attempt < 4 && routeCoverage(assembly.points) < 0.2; attempt += 1) {
    const candidate = assembleModuleRoute(plans, random, config.rows + 2);
    if (routeCoverage(candidate.points) > routeCoverage(assembly.points)) assembly = candidate;
  }
  const flatPoints = assembly.points;
  const distances = pointDistances(flatPoints);
  const totalDistance = distances[distances.length - 1] || 1;

  const zones: TrackZone[] = config.zoneTypes.map((type, zoneIndex) => {
    const startSection = Math.floor((zoneIndex * config.sectionCount) / config.zoneTypes.length);
    const endSection = Math.max(startSection, Math.floor(((zoneIndex + 1) * config.sectionCount) / config.zoneTypes.length) - 1);
    const startPointIndex = assembly.ranges[startSection].startPointIndex;
    const endPointIndex = assembly.ranges[endSection].endPointIndex;
    const metadata = ZONE_SEQUENCE[type];
    const startProgress = distances[startPointIndex] / totalDistance;
    const endProgress = distances[endPointIndex] / totalDistance;
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

  const sectionDrafts: SectionDraft[] = plans.map((plan, index) => {
    const range = assembly.ranges[index];
    const zone = zones[plan.zoneIndex];
    return {
      id: `section-${index}-${hashSeed(`${seed}-${index}`).toString(16)}`,
      type: plan.type,
      zoneId: zone.id,
      startPointIndex: range.startPointIndex,
      endPointIndex: range.endPointIndex,
      startProgress: distances[range.startPointIndex] / totalDistance,
      endProgress: distances[range.endPointIndex] / totalDistance,
      difficulty: plan.type === "split" || plan.type === "funnel" || plan.type === "ice-zone" ? 3 : plan.type === "tunnel" || plan.type === "speed-zone" ? 2 : 1,
      definition: plan.definition,
      length: distances[range.endPointIndex] - distances[range.startPointIndex],
      turn: normalizeAngle(range.exitHeading - range.entryHeading) / Math.PI,
      entryHeading: range.entryHeading,
      exitHeading: range.exitHeading,
      connectorGap: range.connectorGap,
      clearance: range.clearance,
    };
  });
  const elevations = buildVerticalProfile(sectionDrafts, random, difficulty);
  const maximumBank = difficulty === "easy" ? 0.16 : difficulty === "medium" ? 0.24 : 0.31;
  const maximumBridgeLift = difficulty === "easy" ? 0.28 : difficulty === "medium" ? 0.46 : 0.62;
  const bridgeLifts = sectionDrafts.map((draft) => draft.clearance < 0.055
    ? roundPoint(maximumBridgeLift * clamp(1 - draft.clearance / 0.055, 0.24, 1))
    : 0,
  );
  const sectionBanks = sectionDrafts.map((draft) => roundPoint(clamp(
    draft.turn * draft.definition.bankStrength,
    -maximumBank,
    maximumBank,
  )));
  const connectorBanks = Array.from({ length: sectionDrafts.length + 1 }, (_, index) =>
    index === 0 || index === sectionDrafts.length
      ? 0
      : (sectionBanks[index - 1] + sectionBanks[index]) / 2,
  );
  const points: TrackPoint[] = flatPoints.map((point) => ({ ...point, elevation: 0, bank: 0 }));
  sectionDrafts.forEach((draft, sectionIndex) => {
    const pointSpan = Math.max(1, draft.endPointIndex - draft.startPointIndex);
    for (let pointIndex = draft.startPointIndex; pointIndex <= draft.endPointIndex; pointIndex += 1) {
      const local = (pointIndex - draft.startPointIndex) / pointSpan;
      const smoothLocal = local * local * (3 - 2 * local);
      const connectorBank = connectorBanks[sectionIndex] * (1 - local) + connectorBanks[sectionIndex + 1] * local;
      const bankBulge = (sectionBanks[sectionIndex] - (connectorBanks[sectionIndex] + connectorBanks[sectionIndex + 1]) / 2) * Math.sin(local * Math.PI);
      const bridgeArch = Math.sin(local * Math.PI) * bridgeLifts[sectionIndex];
      points[pointIndex].elevation = roundPoint(
        elevations[sectionIndex] * (1 - smoothLocal) + elevations[sectionIndex + 1] * smoothLocal + bridgeArch,
      );
      points[pointIndex].bank = roundPoint(clamp(connectorBank + bankBulge, -maximumBank, maximumBank));
    }
  });
  const sections: TrackSection[] = sectionDrafts.map((draft, index) => {
    const elevationDelta = elevations[index + 1] - elevations[index];
    const worldLength = Math.max(0.01, draft.length * 22);
    return {
      id: draft.id,
      type: draft.type,
      zoneId: draft.zoneId,
      startPointIndex: draft.startPointIndex,
      endPointIndex: draft.endPointIndex,
      startProgress: draft.startProgress,
      endProgress: draft.endProgress,
      difficulty: draft.difficulty,
      moduleId: draft.definition.id,
      surface: draft.definition.surface,
      length: draft.length,
      turn: roundPoint(draft.turn),
      entryHeading: roundPoint(draft.entryHeading),
      exitHeading: roundPoint(draft.exitHeading),
      connectorGap: roundPoint(draft.connectorGap),
      clearance: roundPoint(draft.clearance),
      bridgeLift: bridgeLifts[index],
      bank: sectionBanks[index],
      grade: roundPoint(elevationDelta / worldLength),
      elevationDelta: roundPoint(elevationDelta),
      speedMultiplier: draft.definition.speedMultiplier,
      surfaceGrip: draft.definition.surfaceGrip,
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
  const signature = `${difficulty}-${hashSeed(`${seed}-${points.map((point) => `${point.x},${point.y},${point.elevation}`).join("|")}-${sections.map((section) => section.moduleId).join("|")}`).toString(36)}`;

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
  previousWinnerIds: ReadonlySet<string> = new Set(),
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
      accent: `hsl(${hue}, 86%, 67%)`,
      durationMs: config.durationBaseMs + random() * 2700 + trapVariance + (power ? powerDurationModifier[power] : 0) + index / 1000,
      power,
      powerAt: powerZone ? clamp(powerZone.progress + (random() - 0.5) * 0.025, 0.08, 0.92) : 2,
      lane: random() * 2 - 1,
      previousWinner: previousWinnerIds.has(participant.id),
    } satisfies MarbleRacer;
  });
  const selected = mode === "direct"
    ? racers.reduce((best, racer) => racer.durationMs < best.durationMs ? racer : best)
    : racers.reduce((last, racer) => racer.durationMs > last.durationMs ? racer : last);

  return { track, racers, selected, mode, difficulty };
};

interface TrackMotionProfile {
  progress: number[];
  normalizedTime: number[];
}

const motionProfileCache = new WeakMap<MarbleTrack, TrackMotionProfile>();

const sectionAtProgress = (track: MarbleTrack, progress: number) => {
  let low = 0;
  let high = track.sections.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (track.sections[middle].endProgress < progress) low = middle + 1;
    else high = middle;
  }
  return track.sections[low];
};

const createTrackMotionProfile = (track: MarbleTrack): TrackMotionProfile => {
  const sampleCount = Math.max(240, track.sections.length * 10);
  const progress = Array.from({ length: sampleCount }, (_, index) => index / (sampleCount - 1));
  const normalizedTime = [0];
  let accumulatedTime = 0;
  for (let index = 1; index < progress.length; index += 1) {
    const currentProgress = (progress[index - 1] + progress[index]) / 2;
    const section = sectionAtProgress(track, currentProgress);
    const uphillDrag = clamp(1 - section.grade * 5.2, 0.68, 1.28);
    const curveDrag = clamp(1 - Math.abs(section.turn) * 0.3 / Math.max(0.42, section.surfaceGrip), 0.7, 1.05);
    const sectionLocal = clamp(
      (currentProgress - section.startProgress) / Math.max(0.0001, section.endProgress - section.startProgress),
      0,
      1,
    );
    const bridgeFlow = clamp(1 - Math.cos(sectionLocal * Math.PI) * section.bridgeLift * 0.32, 0.78, 1.22);
    const obstacleDrag = track.obstacles.some((obstacle) => Math.abs(obstacle.progress - currentProgress) < 0.012)
      ? 0.78
      : 1;
    const localSpeed = Math.max(0.38, section.speedMultiplier * uphillDrag * curveDrag * bridgeFlow * obstacleDrag);
    accumulatedTime += (progress[index] - progress[index - 1]) / localSpeed;
    normalizedTime.push(accumulatedTime);
  }
  const total = normalizedTime[normalizedTime.length - 1] || 1;
  for (let index = 1; index < normalizedTime.length; index += 1) normalizedTime[index] /= total;
  return { progress, normalizedTime };
};

const trackMotionProfile = (track: MarbleTrack) => {
  const cached = motionProfileCache.get(track);
  if (cached) return cached;
  const created = createTrackMotionProfile(track);
  motionProfileCache.set(track, created);
  return created;
};

const profileProgressAtTime = (track: MarbleTrack, normalizedTime: number) => {
  const profile = trackMotionProfile(track);
  let low = 0;
  let high = profile.normalizedTime.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (profile.normalizedTime[middle] < normalizedTime) low = middle + 1;
    else high = middle;
  }
  const endIndex = Math.max(1, low);
  const startIndex = endIndex - 1;
  const startTime = profile.normalizedTime[startIndex];
  const endTime = profile.normalizedTime[endIndex];
  const local = clamp((normalizedTime - startTime) / Math.max(0.000001, endTime - startTime), 0, 1);
  return profile.progress[startIndex] + (profile.progress[endIndex] - profile.progress[startIndex]) * local;
};

const powerAdjustedProgress = (racer: MarbleRacer, track: MarbleTrack, raw: number) => {
  // Arranque desde reposo y aceleración sostenida: no hay frenada artificial antes de meta.
  const kineticTime = raw * raw * (2 - raw);
  let progress = profileProgressAtTime(track, kineticTime);
  const at = racer.powerAt;
  const powerWindow = racer.power === "boost" ? 0.14 : racer.power === "restart" ? 0.11 : 0.09;
  const local = clamp((progress - at) / powerWindow, 0, 1);
  const pulse = Math.sin(local * Math.PI);
  if (progress >= at && progress <= at + powerWindow) {
    if (racer.power === "boost") progress += pulse * 0.052;
    else if (racer.power === "freeze") progress -= pulse * 0.038;
    else if (racer.power === "reverse") progress -= pulse * 0.075;
    else if (racer.power === "restart") progress = progress * (1 - local) + 0.025 * local;
  }
  return raw >= 1 ? 1 : clamp(progress, 0, 0.999);
};

export const getMarbleMotion = (
  racer: MarbleRacer,
  track: MarbleTrack,
  elapsedMs: number,
): MarbleMotionState => {
  const raw = clamp(elapsedMs / racer.durationMs, 0, 1);
  const progress = powerAdjustedProgress(racer, track, raw);
  const unadjustedProgress = profileProgressAtTime(track, raw * raw * (2 - raw));
  const section = sectionAtProgress(track, progress);
  const deltaRaw = 0.0015;
  const before = powerAdjustedProgress(racer, track, Math.max(0, raw - deltaRaw));
  const after = powerAdjustedProgress(racer, track, Math.min(1, raw + deltaRaw));
  const elapsedWindowSeconds = Math.max(0.0001, (Math.min(1, raw + deltaRaw) - Math.max(0, raw - deltaRaw)) * racer.durationMs / 1000);
  const velocity = (after - before) / elapsedWindowSeconds;
  const powerActive = racer.power !== null && unadjustedProgress >= racer.powerAt && unadjustedProgress <= racer.powerAt + 0.115;
  const radiusScale = racer.power === "giant" && powerActive
    ? 1.72
    : racer.power === "tiny" && powerActive
      ? 0.54
      : 1;
  let nearestObstacleDistance = Number.POSITIVE_INFINITY;
  let nearestObstacleScale = 0;
  track.obstacles.forEach((obstacle) => {
    const distance = Math.abs(obstacle.progress - progress);
    if (distance < nearestObstacleDistance) {
      nearestObstacleDistance = distance;
      nearestObstacleScale = obstacle.scale;
    }
  });
  const collisionStrength = nearestObstacleDistance < 0.018
    ? (1 - nearestObstacleDistance / 0.018) * nearestObstacleScale
    : 0;
  const gripDrift = (1 - Math.min(1, section.surfaceGrip)) * Math.sin(progress * 93 + racer.number * 1.77);
  const lateralImpulse = clamp(
    gripDrift * 0.72 + Math.sin(elapsedMs / 48 + racer.number * 1.71) * collisionStrength,
    -1.2,
    1.2,
  );
  const sectionSpan = Math.max(0.0001, section.endProgress - section.startProgress);
  const sectionLocal = clamp((progress - section.startProgress) / sectionSpan, 0, 1);
  const connectorBounce = Math.sin(sectionLocal * Math.PI * 2) * 0.012 * Math.min(1, velocity * 9);
  const verticalOffset = Math.max(0, Math.sin(collisionStrength * Math.PI) * 0.11 + connectorBounce);

  return {
    raw,
    progress,
    velocity,
    lateralImpulse,
    verticalOffset,
    spinAngle: progress * 116 + racer.number * 0.31,
    section,
    powerActive,
    radiusScale,
    finished: raw >= 1,
  };
};

/** Compatibilidad para el dibujado antiguo; el trazado habilita el movimiento por piezas. */
export const getMarbleProgress = (racer: MarbleRacer, elapsedMs: number, track?: MarbleTrack) => {
  if (track) return getMarbleMotion(racer, track, elapsedMs);
  const raw = clamp(elapsedMs / racer.durationMs, 0, 1);
  return {
    raw,
    progress: raw >= 1 ? 1 : raw * raw * (2 - raw),
    powerActive: racer.power !== null && raw >= racer.powerAt && raw <= racer.powerAt + 0.115,
    radiusScale: 1,
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
  const elevation = (start.elevation ?? 0) + ((end.elevation ?? 0) - (start.elevation ?? 0)) * local;
  const bank = (start.bank ?? 0) + ((end.bank ?? 0) - (start.bank ?? 0)) * local;
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  return { x, y, elevation, bank, tangentX: (end.x - start.x) / length, tangentY: (end.y - start.y) / length };
};

export const validateMarbleTrack = (track: MarbleTrack): TrackValidationResult => {
  const config = marbleDifficultyConfig[track.difficulty];
  const inBounds = track.points.every((point) =>
    point.x >= 0.045 && point.x <= 0.955 && point.y >= 0.05 && point.y <= 0.95
    && Number.isFinite(point.elevation) && Number.isFinite(point.bank),
  );
  const connected = track.sections.every((section, index) => {
    const previous = index > 0 ? track.sections[index - 1] : null;
    return section.startPointIndex === (previous?.endPointIndex ?? 0)
      && section.endPointIndex > section.startPointIndex
      && section.endProgress > section.startProgress
      && (previous === null || Math.abs(previous.endProgress - section.startProgress) < 0.000001)
      && section.connectorGap <= 0.0001
      && marbleSectionModuleLibrary[section.type].some((module) => module.id === section.moduleId)
      && [
        section.length,
        section.turn,
        section.entryHeading,
        section.exitHeading,
        section.connectorGap,
        section.clearance,
        section.bridgeLift,
        section.bank,
        section.grade,
        section.elevationDelta,
        section.speedMultiplier,
        section.surfaceGrip,
      ].every(Number.isFinite);
  }) && track.sections[track.sections.length - 1]?.endPointIndex === track.points.length - 1;
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
