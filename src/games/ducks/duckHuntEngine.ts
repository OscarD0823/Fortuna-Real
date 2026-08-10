import type { Participant } from "../../core/types";

export const DUCK_STARTING_LIVES = 3;

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

export const prepareDuckContestants = (
  participants: readonly Participant[],
  seed: string,
  previousWinnerIds: ReadonlySet<string> = new Set(),
): DuckContestant[] => participants.map((participant, index) => {
  const random = mulberry32(hashString(`${seed}:${participant.id}:${index}`));
  const band = index % 5;
  const hue = (index * 137.508 + random() * 42) % 360;
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
