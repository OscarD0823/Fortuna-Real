import type { Participant } from "../../core/types";

export const DUCK_STARTING_LIVES = 3;

export type DuckSabotagePower = "palette" | "shake" | "invert";
export type DuckForestEventType = "wind" | "mist" | "fireflies" | "storm";

export interface DuckForestEvent {
  type: DuckForestEventType;
  label: string;
  description: string;
  color: string;
}

export const duckForestEventDefinitions: Record<DuckForestEventType, Omit<DuckForestEvent, "type">> = {
  wind: {
    label: "Ráfaga entre los árboles",
    description: "Las copas y el pasto anuncian desde dónde saldrá la bandada.",
    color: "#b8f28d",
  },
  mist: {
    label: "Niebla sobre el estanque",
    description: "La bruma cubre el fondo, pero los objetivos mantienen su silueta.",
    color: "#b9e8f5",
  },
  fireflies: {
    label: "Enjambre de luciérnagas",
    description: "Destellos dorados recorren el bosque mientras los patos cambian de refugio.",
    color: "#e8ff72",
  },
  storm: {
    label: "Tormenta del bosque",
    description: "El cielo oscurece y relámpagos breves marcan el inicio de la tanda.",
    color: "#9eb7ff",
  },
};

export const DUCK_SABOTAGE_POWERS: readonly DuckSabotagePower[] = [
  "palette",
  "shake",
  "invert",
];

export const duckSabotageDefinitions: Record<DuckSabotagePower, {
  label: string;
  description: string;
  durationMs: number;
  color: string;
}> = {
  palette: {
    label: "Paleta alterada",
    description: "Desplaza temporalmente los colores del bosque y la bandada.",
    durationMs: 2_400,
    color: "#d77cff",
  },
  shake: {
    label: "Temblor del bosque",
    description: "Sacude el campo de tiro sin mover el punto real del impacto.",
    durationMs: 1_650,
    color: "#ffb52e",
  },
  invert: {
    label: "Visión invertida",
    description: "Invierte por unos instantes la imagen del campo.",
    durationMs: 1_900,
    color: "#58e8ff",
  },
};

export interface DuckFlightProfile {
  lane: number;
  altitude: number;
  depth: number;
  phase: number;
  drift: number;
  scale: number;
}

export interface DuckContestant {
  id: string;
  number: number;
  participant: Participant;
  accent: string;
  lives: number;
  speed: number;
  revealed: boolean;
  knockedOut: boolean;
  previousWinner: boolean;
  grazed: boolean;
  shielded: boolean;
  routeSeed: number;
  dodgeX: number;
  dodgeY: number;
  threatLevel: number;
  power: DuckSabotagePower;
  profile: DuckFlightProfile;
}

export interface DuckHitResult {
  contestants: DuckContestant[];
  target: DuckContestant;
  knockedOut: boolean;
  shieldAbsorbed: boolean;
  survivor: DuckContestant | null;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const secureRandomValues = (count: number) => {
  const values = new Uint32Array(Math.max(1, count));
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value / 2 ** 32);
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const getDuckForestEvent = (seed: string, waveNumber: number): DuckForestEvent => {
  const types = Object.keys(duckForestEventDefinitions) as DuckForestEventType[];
  const type = types[hashString(`${seed}:forest-event:${Math.max(1, waveNumber)}`) % types.length];
  return { type, ...duckForestEventDefinitions[type] };
};

const mulberry32 = (seed: number) => () => {
  let value = seed += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

export const createDuckSeed = () => {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `bandada-${values[0].toString(36)}-${values[1].toString(36)}`;
};

export const getDuckSpeed = (lives: number) => 1 + (DUCK_STARTING_LIVES - lives) * 0.34;

/**
 * Mantiene cada pato como un objetivo legible sin desbordar bandadas grandes.
 * Las bandadas pequeñas priorizan un blanco táctil y visual claro; desde 46
 * participantes se reduce progresivamente para conservar las 200 instancias.
 */
export const getDuckVisualScale = (count: number) => {
  if (count > 150) return 0.5;
  if (count > 90) return 0.6;
  if (count > 45) return 0.72;
  if (count > 20) return 0.92;
  return 1.08;
};

export const getDuckHitRadius = (count: number) => {
  if (count > 120) return 25;
  if (count > 60) return 31;
  if (count > 20) return 38;
  return 46;
};

/** Duración visual de la entrada al refugio y la salida colectiva. */
export const getDuckResetDuration = (count: number) => {
  if (count > 100) return 620;
  if (count > 50) return 880;
  if (count > 20) return 1_240;
  return 2_050;
};

/**
 * Cantidad de ocultamiento entre 0 (vuelo libre) y 1 (dentro de la cobertura).
 * La fase depende solo del perfil visual del pato: no toca el orden sellado.
 */
export const getDuckCoverAmount = (contestant: DuckContestant, elapsedSeconds: number) => {
  if (elapsedSeconds < 1.8 || contestant.knockedOut) return 0;
  const cycle = 7.4 + contestant.routeSeed * 4.1 + (contestant.number % 4) * 0.37;
  const phaseOffset = contestant.routeSeed * cycle + (contestant.profile.phase / (Math.PI * 2)) * 2.3;
  const local = (elapsedSeconds - 1.8 + phaseOffset) % cycle;
  const hideStart = cycle * (0.52 + (contestant.number % 3) * 0.045);
  const hideEnd = Math.min(cycle - 0.72, hideStart + 1.35 + contestant.routeSeed * 1.15);
  const transitionIn = 0.42;
  const transitionOut = 0.58;
  if (local < hideStart || local > hideEnd) return 0;
  if (local < hideStart + transitionIn) return smoothstep01((local - hideStart) / transitionIn);
  if (local > hideEnd - transitionOut) return smoothstep01((hideEnd - local) / transitionOut);
  return 1;
};

export const getDuckCoverKind = (contestant: DuckContestant) =>
  contestant.number % 3 === 0 ? "grass" as const : "forest" as const;

const smoothstep01 = (value: number) => {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
};

export const prepareDuckContestants = (
  participants: readonly Participant[],
  seed: string,
  previousWinnerIds: ReadonlySet<string> = new Set(),
): DuckContestant[] => participants.map((participant, index) => {
  const random = mulberry32(hashString(`${seed}:${participant.id}:${index}`));
  const band = index % 5;
  const hue = (index * 137.508 + random() * 42) % 360;
  const power = DUCK_SABOTAGE_POWERS[Math.floor(random() * DUCK_SABOTAGE_POWERS.length)];
  return {
    id: participant.id,
    number: index + 1,
    participant,
    accent: `hsl(${hue}, 86%, 61%)`,
    lives: DUCK_STARTING_LIVES,
    speed: getDuckSpeed(DUCK_STARTING_LIVES),
    revealed: false,
    knockedOut: false,
    previousWinner: previousWinnerIds.has(participant.id),
    grazed: false,
    shielded: false,
    routeSeed: random(),
    dodgeX: 0,
    dodgeY: 0,
    threatLevel: 0,
    power,
    profile: {
      lane: (random() * 2 - 1) * 0.88,
      altitude: 2.9 + band * 0.62 + random() * 1.15,
      depth: -2.6 + random() * 7.2,
      phase: random() * Math.PI * 2,
      drift: 0.72 + random() * 0.75,
      scale: 0.78 + random() * 0.34,
    },
  };
});

export const hitDuckContestant = (
  contestants: readonly DuckContestant[],
  targetId: string,
): DuckHitResult | null => {
  const currentTarget = contestants.find((contestant) => contestant.id === targetId);
  if (!currentTarget || currentTarget.knockedOut || currentTarget.lives <= 0) return null;

  const shieldAbsorbed = currentTarget.shielded;
  const nextLives = shieldAbsorbed ? currentTarget.lives : Math.max(0, currentTarget.lives - 1);
  const nextContestants = contestants.map((contestant) => contestant.id === targetId
    ? {
        ...contestant,
        lives: nextLives,
        speed: getDuckSpeed(nextLives),
        revealed: true,
        shielded: false,
        knockedOut: nextLives === 0,
      }
    : contestant,
  );
  const target = nextContestants.find((contestant) => contestant.id === targetId) as DuckContestant;
  const living = nextContestants.filter((contestant) => !contestant.knockedOut);

  return {
    contestants: nextContestants,
    target,
    knockedOut: !shieldAbsorbed && nextLives === 0,
    shieldAbsorbed,
    survivor: living.length === 1 ? living[0] : null,
  };
};

export const learnFromDuckShot = (
  contestants: readonly DuckContestant[],
  threatX: number,
  threatY: number,
  grazedId: string | null,
): DuckContestant[] => {
  const entropy = secureRandomValues(contestants.length * 2);
  return contestants.map((contestant, index) => {
    if (contestant.knockedOut) return contestant;
    const horizontalAvoidance = contestant.profile.lane + contestant.dodgeX >= threatX ? 1 : -1;
    const verticalAvoidance = contestant.profile.altitude + contestant.dodgeY >= 4.4 + threatY * 1.8 ? 1 : -1;
    return {
      ...contestant,
      grazed: contestant.grazed || contestant.id === grazedId,
      dodgeX: clamp(
        contestant.dodgeX * 0.58 + horizontalAvoidance * (0.24 + entropy[index * 2] * 0.54),
        -1.8,
        1.8,
      ),
      dodgeY: clamp(
        contestant.dodgeY * 0.62 + verticalAvoidance * (0.12 + entropy[index * 2 + 1] * 0.34),
        -0.9,
        0.9,
      ),
      threatLevel: clamp(contestant.threatLevel + 0.16 + entropy[index * 2] * 0.06, 0, 1),
    };
  });
};

export const prepareDuckNextFlight = (
  contestants: readonly DuckContestant[],
): DuckContestant[] => {
  const entropy = secureRandomValues(contestants.length * 3);
  return contestants.map((contestant, index) => {
    if (contestant.knockedOut) return contestant;
    const shielded = contestant.shielded || (contestant.grazed && entropy[index * 3] < 0.46);
    return {
      ...contestant,
      grazed: false,
      shielded,
      routeSeed: entropy[index * 3 + 1],
      dodgeX: clamp(contestant.dodgeX + (entropy[index * 3 + 2] - 0.5) * 0.8, -2.1, 2.1),
      dodgeY: clamp(contestant.dodgeY + (entropy[index * 3] - 0.5) * 0.48, -1.05, 1.05),
    };
  });
};

export const duckLivesLabel = (lives: number) => lives === 1 ? "1 vida" : `${lives} vidas`;
