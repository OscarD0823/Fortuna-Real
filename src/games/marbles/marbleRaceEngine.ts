import type { DrawMode, Participant } from "../../core/types";

export type MarblePower = "boost" | "freeze" | "reverse" | "giant" | "tiny" | "restart";
export type TrackObstacleType = "spinner" | "bumpers" | "gate" | "boost" | "ice" | "portal";

export interface TrackPoint {
  x: number;
  y: number;
}

export interface TrackObstacle {
  id: string;
  type: TrackObstacleType;
  progress: number;
}

export interface MarbleTrack {
  seed: string;
  name: string;
  points: TrackPoint[];
  obstacles: TrackObstacle[];
}

export interface MarbleRacer {
  id: string;
  number: number;
  participant: Participant;
  color: string;
  accent: string;
  durationMs: number;
  power: MarblePower;
  powerAt: number;
  lane: number;
}

export interface PreparedMarbleRace {
  track: MarbleTrack;
  racers: MarbleRacer[];
  selected: MarbleRacer;
  mode: DrawMode;
}

const POWER_SEQUENCE: MarblePower[] = ["boost", "freeze", "reverse", "giant", "tiny", "restart"];
const OBSTACLE_SEQUENCE: TrackObstacleType[] = ["spinner", "bumpers", "gate", "boost", "ice", "portal"];
const TRACK_NAMES = ["Órbita Real", "Neón Dorado", "Corona Mecánica", "Túnel Fortuna", "Circuito Imperial"];

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

export const createMarbleSeed = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const generateMarbleTrack = (seed: string): MarbleTrack => {
  const random = seededRandom(`track-${seed}`);
  const pointCount = 13;
  const phase = random() * Math.PI * 2;
  const points = Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);
    if (index === 0 || index === pointCount - 1) return { x: 0.5, y: 0.035 + progress * 0.93 };
    const wave = Math.sin(index * 1.42 + phase) * 0.22;
    const variation = (random() - 0.5) * 0.22;
    return {
      x: clamp(0.5 + wave + variation, 0.18, 0.82),
      y: 0.035 + progress * 0.93,
    };
  });
  const obstacleProgress = [0.16, 0.31, 0.48, 0.65, 0.82];
  const obstacleOffset = Math.floor(random() * OBSTACLE_SEQUENCE.length);
  const obstacles = obstacleProgress.map((progress, index) => ({
    id: `obstacle-${index}-${seed}`,
    type: OBSTACLE_SEQUENCE[(index + obstacleOffset) % OBSTACLE_SEQUENCE.length],
    progress,
  }));

  return {
    seed,
    name: TRACK_NAMES[Math.floor(random() * TRACK_NAMES.length)],
    points,
    obstacles,
  };
};

const powerDurationModifier: Record<MarblePower, number> = {
  boost: -520,
  freeze: 580,
  reverse: 430,
  giant: 160,
  tiny: -120,
  restart: 720,
};

export const prepareMarbleRace = (
  participants: readonly Participant[],
  mode: DrawMode,
  seed: string,
): PreparedMarbleRace => {
  if (participants.length < 2) throw new Error("La carrera necesita al menos dos participantes.");
  const random = seededRandom(`racers-${seed}-${participants.map((person) => person.id).join("|")}`);
  const racers = participants.map((participant, index) => {
    const power = POWER_SEQUENCE[Math.floor(random() * POWER_SEQUENCE.length)];
    const hue = (index * 137.508 + random() * 38) % 360;
    return {
      id: `marble-${participant.id}`,
      number: index + 1,
      participant,
      color: participant.color,
      accent: `hsl(${hue} 86% 67%)`,
      durationMs: 5600 + random() * 2500 + powerDurationModifier[power] + index / 1000,
      power,
      powerAt: 0.22 + random() * 0.55,
      lane: random() * 2 - 1,
    } satisfies MarbleRacer;
  });
  const selected = mode === "direct"
    ? racers.reduce((best, racer) => racer.durationMs < best.durationMs ? racer : best)
    : racers.reduce((last, racer) => racer.durationMs > last.durationMs ? racer : last);

  return {
    track: generateMarbleTrack(seed),
    racers,
    selected,
    mode,
  };
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

  const powerActive = raw >= at && raw <= at + 0.115;
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
  const scaled = clamp(progress, 0, 1) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const start = points[index];
  const end = points[index + 1];
  const x = start.x + (end.x - start.x) * local;
  const y = start.y + (end.y - start.y) * local;
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  return {
    x,
    y,
    tangentX: (end.x - start.x) / length,
    tangentY: (end.y - start.y) / length,
  };
};

export const powerLabels: Record<MarblePower, string> = {
  boost: "Turbo",
  freeze: "Congelada",
  reverse: "Marcha atrás",
  giant: "Canica gigante",
  tiny: "Canica mini",
  restart: "Regresa al inicio",
};
