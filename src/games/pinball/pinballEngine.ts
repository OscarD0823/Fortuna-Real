import type { DrawMode, Participant, PinballControlMode } from "../../core/types";
import { sha256Hex } from "../../shared/crypto/sha256.ts";
import { uniformIndexFromUint32 } from "../roulette/rouletteCommitment.ts";

export interface PinballPoint {
  x: number;
  z: number;
}

export interface PinballBumper extends PinballPoint {
  id: string;
  radius: number;
  color: string;
  strength: number;
}

export interface PinballPeg extends PinballPoint {
  id: string;
  radius: number;
}

export interface PinballSpinner extends PinballPoint {
  id: string;
  rotation: number;
  length: number;
  color: string;
}

export interface PinballLane extends PinballPoint {
  id: string;
  width: number;
  color: string;
  label: string;
}

export interface PinballFinishGate extends PinballPoint {
  width: number;
}

export interface PinballLayout {
  seed: string;
  signature: string;
  name: string;
  width: number;
  height: number;
  bumpers: PinballBumper[];
  pegs: PinballPeg[];
  spinners: PinballSpinner[];
  lanes: PinballLane[];
  jackpot: PinballPoint;
  launch: PinballPoint;
  drain: PinballPoint;
  finishGate: PinballFinishGate;
}

export interface PinballBallAssignment {
  id: string;
  number: number;
  participant: Participant;
  color: string;
  accent: string;
  launchDelayMs: number;
  laneBias: number;
  previousWinner: boolean;
}

export interface PreparedPinballRound {
  layout: PinballLayout;
  balls: PinballBallAssignment[];
  selected: PinballBallAssignment;
  selectedIndex: number;
  commitmentId: string;
  drawMode: DrawMode;
  controlMode: PinballControlMode;
  overtimeAfterMs: number;
}

export interface PinballPhysicsBall {
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  launched: boolean;
  drained: boolean;
  respawnAtMs: number;
  collisions: number;
}

export interface PinballFlipperState {
  left: boolean;
  right: boolean;
  leftAngle?: number;
  rightAngle?: number;
}

export type PinballSide = "left" | "right";

export interface PinballSegmentCollider {
  id: string;
  start: PinballPoint;
  end: PinballPoint;
  radius: number;
}

export interface PinballPhysicsFrame {
  delta: number;
  dampingX: number;
  dampingZ: number;
  leftFlipper: PinballSegmentCollider;
  rightFlipper: PinballSegmentCollider;
  spinnerColliders: PinballSegmentCollider[];
}

export interface PinballTargetBankDefinition extends PinballPoint {
  id: string;
  count: number;
  spacing: number;
  rotation: number;
  radius: number;
}

export interface PinballFlipperDefinition extends PinballPoint {
  side: PinballSide;
  direction: -1 | 1;
  length: number;
  radius: number;
  restAngle: number;
  activeAngle: number;
}

export interface PinballValidation {
  valid: boolean;
  inBounds: boolean;
  separated: boolean;
  bumperCount: number;
  pegCount: number;
  spinnerCount: number;
}

const BOARD_WIDTH = 16;
const BOARD_HEIGHT = 24;
const BOARD_HALF_WIDTH = BOARD_WIDTH / 2;
const BOARD_HALF_HEIGHT = BOARD_HEIGHT / 2;
const PALETTE = ["#09e0df", "#f6bd35", "#ef5a45", "#8d68ff", "#52dc8b", "#35a9ff"];
const BOARD_NAMES = [
  "Palacio del Jackpot",
  "Cámara Imperial",
  "Neón de la Fortuna",
  "Salón de la Corona",
  "Máquina Real",
  "Bóveda Magnética",
];

export const PINBALL_TARGET_BANKS: readonly PinballTargetBankDefinition[] = [
  { id: "target-bank-left", x: -3.25, z: 1.65, count: 4, spacing: 0.78, rotation: 0.3, radius: 0.3 },
  { id: "target-bank-right", x: 3.3, z: -2.5, count: 3, spacing: 0.78, rotation: -0.38, radius: 0.3 },
];

export const PINBALL_SLING_COLLIDERS: readonly PinballSegmentCollider[] = [
  { id: "sling-left", start: { x: -2.75, z: 7.28 }, end: { x: -0.58, z: 7.28 }, radius: 0.17 },
  { id: "sling-right", start: { x: 0.58, z: 7.28 }, end: { x: 2.75, z: 7.28 }, radius: 0.17 },
];

export const PINBALL_FLIPPERS: Readonly<Record<PinballSide, PinballFlipperDefinition>> = {
  left: {
    side: "left",
    direction: 1,
    x: -2.55,
    z: 8.55,
    length: 2.15,
    radius: 0.32,
    restAngle: -0.28,
    activeAngle: 0.48,
  },
  right: {
    side: "right",
    direction: -1,
    x: 2.55,
    z: 8.55,
    length: 2.15,
    radius: 0.32,
    restAngle: 0.28,
    activeAngle: -0.48,
  },
};

export const PINBALL_TARGET_COLLIDERS: readonly PinballSegmentCollider[] = PINBALL_TARGET_BANKS.flatMap((bank) =>
  Array.from({ length: bank.count }, (_, index) => {
    const localX = (index - (bank.count - 1) / 2) * bank.spacing;
    const x = bank.x + localX * Math.cos(bank.rotation);
    const z = bank.z - localX * Math.sin(bank.rotation);
    return {
      id: `${bank.id}-${index}`,
      start: { x, z },
      end: { x, z },
      radius: bank.radius,
    };
  }),
);

export const getPinballTargetColliders = () => PINBALL_TARGET_COLLIDERS;

export const getPinballFlipperCollider = (
  side: PinballSide,
  angle = PINBALL_FLIPPERS[side].restAngle,
): PinballSegmentCollider => {
  const definition = PINBALL_FLIPPERS[side];
  const directionX = Math.cos(angle) * definition.direction;
  const directionZ = -Math.sin(angle) * definition.direction;
  return {
    id: `flipper-${side}`,
    start: { x: definition.x, z: definition.z },
    end: {
      x: definition.x + directionX * definition.length,
      z: definition.z + directionZ * definition.length,
    },
    radius: definition.radius,
  };
};

export const createPinballPhysicsFrame = (
  layout: PinballLayout,
  deltaSeconds: number,
  flippers: PinballFlipperState,
  spinnerAngles?: readonly number[],
): PinballPhysicsFrame => {
  const delta = clamp(deltaSeconds, 0, 0.034);
  return {
    delta,
    dampingX: Math.pow(0.995, delta * 60),
    dampingZ: Math.pow(0.997, delta * 60),
    leftFlipper: getPinballFlipperCollider(
      "left",
      flippers.leftAngle ?? (flippers.left ? PINBALL_FLIPPERS.left.activeAngle : PINBALL_FLIPPERS.left.restAngle),
    ),
    rightFlipper: getPinballFlipperCollider(
      "right",
      flippers.rightAngle ?? (flippers.right ? PINBALL_FLIPPERS.right.activeAngle : PINBALL_FLIPPERS.right.restAngle),
    ),
    spinnerColliders: layout.spinners.map((spinner, index) => {
      const angle = spinnerAngles?.[index] ?? spinner.rotation;
      const halfLength = spinner.length / 2;
      const axisX = Math.cos(angle) * halfLength;
      const axisZ = -Math.sin(angle) * halfLength;
      return {
        id: spinner.id,
        start: { x: spinner.x - axisX, z: spinner.z - axisZ },
        end: { x: spinner.x + axisX, z: spinner.z + axisZ },
        radius: 0.14,
      };
    }),
  };
};

export const canConfirmPinballFinish = (launchedCount: number, totalCount: number) =>
  totalCount > 0 && launchedCount >= totalCount;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const hashPinballSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const createPinballRandom = (seed: string) => {
  const drawUint32 = createPinballUint32(seed);
  return () => drawUint32() / 4294967296;
};

export const createPinballUint32 = (seed: string) => {
  let counter = 0;
  let pool: number[] = [];
  return () => {
    if (pool.length === 0) {
      const digest = sha256Hex(`${seed}:${counter}`);
      counter += 1;
      pool = Array.from({ length: 8 }, (_, index) =>
        Number.parseInt(digest.slice(index * 8, index * 8 + 8), 16) >>> 0,
      );
    }
    return pool.shift() ?? 0;
  };
};

export const createPinballSeed = () => {
  if (typeof crypto === "undefined" || !("randomUUID" in crypto)) {
    throw new Error("Este equipo no ofrece una fuente criptográfica segura para Pinball.");
  }
  return crypto.randomUUID();
};

const overlaps = (
  candidate: PinballPoint,
  radius: number,
  occupied: Array<PinballPoint & { radius: number }>,
  padding = 0.42,
) => occupied.some((item) => Math.hypot(candidate.x - item.x, candidate.z - item.z) < radius + item.radius + padding);

const pointKey = (point: PinballPoint) => `${point.x.toFixed(3)},${point.z.toFixed(3)}`;

export const generatePinballLayout = (seed: string, participantCount = 2): PinballLayout => {
  const random = createPinballRandom(`layout-${seed}-${participantCount}`);
  const density = participantCount > 120 ? 0 : participantCount > 64 ? 1 : 2;
  const bumperCount = 6 + density + Math.floor(random() * 2);
  const pegCount = 18 + density * 4 + Math.floor(random() * 5);
  const spinnerCount = 2 + Math.floor(random() * 2);
  const occupied: Array<PinballPoint & { radius: number }> = [];

  const bumpers: PinballBumper[] = [];
  for (let index = 0; index < bumperCount; index += 1) {
    let candidate: PinballPoint = { x: 0, z: -2 };
    let attempts = 0;
    const radius = 0.78 + random() * 0.26;
    do {
      const row = Math.floor(index / 3);
      candidate = {
        x: clamp((index % 3 - 1) * 3.55 + (random() - 0.5) * 1.45, -5.45, 5.2),
        z: clamp(-7.8 + row * 4.15 + (random() - 0.5) * 1.35, -8.7, 4.4),
      };
      attempts += 1;
    } while ((candidate.x > 5.2 || overlaps(candidate, radius, occupied, 0.65)) && attempts < 35);
    occupied.push({ ...candidate, radius });
    bumpers.push({
      id: `bumper-${index}-${hashPinballSeed(`${seed}-b-${index}`).toString(36)}`,
      ...candidate,
      radius,
      color: PALETTE[(index + Math.floor(random() * PALETTE.length)) % PALETTE.length],
      strength: 1.04 + random() * 0.38,
    });
  }

  const pegs: PinballPeg[] = [];
  for (let index = 0; index < pegCount; index += 1) {
    let candidate: PinballPoint = { x: 0, z: 0 };
    let attempts = 0;
    const radius = 0.2;
    do {
      candidate = {
        x: -6.1 + random() * 11.75,
        z: -9.5 + random() * 16.3,
      };
      attempts += 1;
    } while ((candidate.x > 5.15 || overlaps(candidate, radius, occupied, 0.34)) && attempts < 70);
    occupied.push({ ...candidate, radius });
    pegs.push({
      id: `peg-${index}-${hashPinballSeed(`${seed}-p-${index}`).toString(36)}`,
      ...candidate,
      radius,
    });
  }

  const spinners: PinballSpinner[] = Array.from({ length: spinnerCount }, (_, index) => ({
    id: `spinner-${index}-${hashPinballSeed(`${seed}-s-${index}`).toString(36)}`,
    x: clamp((index % 2 === 0 ? -1 : 1) * (2.15 + random() * 2.1), -5.2, 5.1),
    z: -5.2 + index * 5.3 + (random() - 0.5) * 1.6,
    rotation: (random() - 0.5) * Math.PI,
    length: 1.45 + random() * 0.55,
    color: PALETTE[(index + 1) % PALETTE.length],
  }));

  const lanes: PinballLane[] = [
    { id: "lane-cyan", x: -4.85, z: -9.65, width: 1.55, color: "#09e0df", label: "TURBO" },
    { id: "lane-gold", x: 0, z: -10.1, width: 1.65, color: "#f6bd35", label: "JACKPOT" },
    { id: "lane-violet", x: 4.45, z: -9.55, width: 1.5, color: "#a675ff", label: "BONUS" },
  ].map((lane, index) => ({ ...lane, x: clamp(lane.x + (random() - 0.5) * 0.7, -5.3, 5.1), z: lane.z + (index === 1 ? 0 : (random() - 0.5) * 0.45) }));

  const signatureSource = [
    ...bumpers.map(pointKey),
    ...pegs.map(pointKey),
    ...spinners.map(pointKey),
  ].join("|");

  return {
    seed,
    signature: `PIN-${hashPinballSeed(`${seed}-${signatureSource}`).toString(36).toUpperCase()}`,
    name: BOARD_NAMES[Math.floor(random() * BOARD_NAMES.length)],
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    bumpers,
    pegs,
    spinners,
    lanes,
    jackpot: { x: lanes[1].x, z: -8.65 },
    launch: { x: 6.55, z: 9.6 },
    drain: { x: 0, z: 11.15 },
    finishGate: { x: 0, z: 9.82, width: 1.9 },
  };
};

export const preparePinballRound = (
  participants: readonly Participant[],
  drawMode: DrawMode,
  controlMode: PinballControlMode,
  seed: string,
  previousWinnerIds: ReadonlySet<string> = new Set(),
): PreparedPinballRound => {
  if (participants.length < 2) throw new Error("Pinball necesita al menos dos participantes.");
  const layout = generatePinballLayout(seed, participants.length);
  const random = createPinballRandom(`balls-${seed}-${participants.map((participant) => participant.id).join("|")}`);
  const balls = participants.map((participant, index) => {
    const hue = (index * 137.508 + random() * 48) % 360;
    return {
      id: `pinball-${participant.id}`,
      number: index + 1,
      participant,
      color: participant.color,
      accent: `hsl(${hue}, 92%, 68%)`,
      launchDelayMs: 0,
      laneBias: random() * 2 - 1,
      previousWinner: previousWinnerIds.has(participant.id),
    } satisfies PinballBallAssignment;
  });
  const selectedIndex = uniformIndexFromUint32(
    balls.length,
    createPinballUint32(`result-${seed}-${participants.map((participant) => participant.id).join("|")}`),
  );
  const selected = balls[selectedIndex];
  const proof = JSON.stringify({
    version: 3,
    layout: layout.signature,
    participants: participants.map((participant) => participant.id),
    launch: balls.map((ball) => [ball.participant.id, ball.launchDelayMs, ball.laneBias]),
    selectedParticipantId: selected.participant.id,
    drawMode,
    controlMode,
  });
  return {
    layout,
    balls,
    selected,
    selectedIndex,
    commitmentId: `PIN-${sha256Hex(proof).toUpperCase()}`,
    drawMode,
    controlMode,
    overtimeAfterMs: clamp(7200 + participants.length * 8, 7500, 9000),
  };
};

export const getPinballFinishCrossing = (
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  gate: PinballFinishGate,
) => {
  if (toZ <= fromZ || fromZ > gate.z || toZ < gate.z) return null;
  const progress = (gate.z - fromZ) / Math.max(0.000001, toZ - fromZ);
  const crossingX = fromX + (toX - fromX) * progress;
  return Math.abs(crossingX - gate.x) <= gate.width / 2 ? progress : null;
};

export const createPinballPhysicsBall = (assignment: PinballBallAssignment, layout: PinballLayout): PinballPhysicsBall => ({
  x: layout.launch.x + assignment.laneBias * 0.38,
  z: layout.launch.z + ((assignment.number - 1) % 3 - 1) * 0.055,
  vx: 0,
  vz: 0,
  radius: 0.23,
  launched: false,
  drained: false,
  respawnAtMs: 0,
  collisions: 0,
});

export const launchPinballPhysicsBall = (
  ball: PinballPhysicsBall,
  assignment: PinballBallAssignment,
  layout: PinballLayout,
) => {
  ball.x = layout.launch.x + assignment.laneBias * 0.38;
  ball.z = layout.launch.z + ((assignment.number - 1) % 3 - 1) * 0.055;
  ball.vx = -0.65 + assignment.laneBias * 1.65;
  ball.vz = -13.4;
  ball.launched = true;
  ball.drained = false;
  ball.respawnAtMs = 0;
};

const collideCircle = (
  ball: PinballPhysicsBall,
  obstacle: PinballPoint,
  radius: number,
  restitution: number,
) => {
  const dx = ball.x - obstacle.x;
  const dz = ball.z - obstacle.z;
  const minimum = ball.radius + radius;
  const distanceSquared = dx * dx + dz * dz;
  if (distanceSquared >= minimum * minimum || distanceSquared < 0.000001) return false;
  const distance = Math.sqrt(distanceSquared);
  const nx = dx / distance;
  const nz = dz / distance;
  const overlap = minimum - distance;
  ball.x += nx * overlap;
  ball.z += nz * overlap;
  const normalVelocity = ball.vx * nx + ball.vz * nz;
  if (normalVelocity < 0) {
    ball.vx -= (1 + restitution) * normalVelocity * nx;
    ball.vz -= (1 + restitution) * normalVelocity * nz;
  }
  ball.collisions += 1;
  return true;
};

const collideSegment = (
  ball: PinballPhysicsBall,
  collider: PinballSegmentCollider,
  restitution: number,
) => {
  const segmentX = collider.end.x - collider.start.x;
  const segmentZ = collider.end.z - collider.start.z;
  const segmentLengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  const projection = segmentLengthSquared > 0.000001
    ? clamp(
      ((ball.x - collider.start.x) * segmentX + (ball.z - collider.start.z) * segmentZ) / segmentLengthSquared,
      0,
      1,
    )
    : 0;
  const nearestX = collider.start.x + segmentX * projection;
  const nearestZ = collider.start.z + segmentZ * projection;
  let normalX = ball.x - nearestX;
  let normalZ = ball.z - nearestZ;
  const minimum = ball.radius + collider.radius;
  const distanceSquared = normalX * normalX + normalZ * normalZ;
  if (distanceSquared >= minimum * minimum) return false;

  let distance = Math.sqrt(distanceSquared);
  if (distance < 0.000001) {
    const segmentLength = Math.sqrt(segmentLengthSquared);
    if (segmentLength > 0.000001) {
      normalX = -segmentZ / segmentLength;
      normalZ = segmentX / segmentLength;
    } else {
      normalX = 0;
      normalZ = -1;
    }
    distance = 0;
  } else {
    normalX /= distance;
    normalZ /= distance;
  }

  const overlap = minimum - distance;
  ball.x += normalX * overlap;
  ball.z += normalZ * overlap;
  const normalVelocity = ball.vx * normalX + ball.vz * normalZ;
  if (normalVelocity < 0) {
    ball.vx -= (1 + restitution) * normalVelocity * normalX;
    ball.vz -= (1 + restitution) * normalVelocity * normalZ;
  }
  ball.collisions += 1;
  return true;
};

export const stepPinballPhysics = (
  ball: PinballPhysicsBall,
  layout: PinballLayout,
  deltaSeconds: number,
  flippers: PinballFlipperState,
  spinnerAngles?: readonly number[],
  preparedFrame?: PinballPhysicsFrame,
) => {
  if (!ball.launched || ball.drained) return 0;
  const before = ball.collisions;
  const frame = preparedFrame ?? createPinballPhysicsFrame(layout, deltaSeconds, flippers, spinnerAngles);
  const delta = frame.delta;
  ball.vz += 4.1 * delta;
  ball.vx *= frame.dampingX;
  ball.vz *= frame.dampingZ;
  ball.x += ball.vx * delta;
  ball.z += ball.vz * delta;

  const horizontalLimit = BOARD_HALF_WIDTH - 0.52;
  if (ball.x < -horizontalLimit || ball.x > horizontalLimit) {
    ball.x = clamp(ball.x, -horizontalLimit, horizontalLimit);
    ball.vx *= -0.84;
    ball.collisions += 1;
  }
  const topLimit = -BOARD_HALF_HEIGHT + 0.55;
  if (ball.z < topLimit) {
    ball.z = topLimit;
    ball.vz = Math.abs(ball.vz) * 0.82;
    ball.collisions += 1;
  }

  for (const bumper of layout.bumpers) {
    if (collideCircle(ball, bumper, bumper.radius, bumper.strength)) {
      const speed = Math.hypot(ball.vx, ball.vz);
      if (speed < 8.5) {
        ball.vx *= 1.16;
        ball.vz *= 1.16;
      }
    }
  }
  for (const peg of layout.pegs) collideCircle(ball, peg, peg.radius, 0.86);
  layout.spinners.forEach((spinner, index) => {
    if (collideSegment(ball, frame.spinnerColliders[index], 0.94)) {
      ball.vx += (spinner.rotation >= 0 ? 1 : -1) * 1.15;
      ball.vz -= 0.7;
    }
  });

  PINBALL_TARGET_COLLIDERS.forEach((target) => {
    if (collideSegment(ball, target, 1.08)) ball.vz -= 0.75;
  });

  if (ball.vz > 0 && collideSegment(ball, PINBALL_SLING_COLLIDERS[0], 0.92)) {
    ball.vx += 2.25;
    ball.vz = -Math.max(7.8, Math.abs(ball.vz) * 0.82);
  }
  if (ball.vz > 0 && collideSegment(ball, PINBALL_SLING_COLLIDERS[1], 0.92)) {
    ball.vx -= 2.25;
    ball.vz = -Math.max(7.8, Math.abs(ball.vz) * 0.82);
  }

  if (collideSegment(ball, frame.leftFlipper, 0.9) && flippers.left) {
    ball.vz = -11.4 - Math.abs(ball.vx) * 0.15;
    ball.vx += 2.3;
  }
  if (collideSegment(ball, frame.rightFlipper, 0.9) && flippers.right) {
    ball.vz = -11.4 - Math.abs(ball.vx) * 0.15;
    ball.vx -= 2.3;
  }

  const speed = Math.hypot(ball.vx, ball.vz);
  if (speed > 17) {
    const scale = 17 / speed;
    ball.vx *= scale;
    ball.vz *= scale;
  }
  if (ball.z > BOARD_HALF_HEIGHT - 0.3) ball.drained = true;
  return ball.collisions - before;
};

export const validatePinballLayout = (layout: PinballLayout): PinballValidation => {
  const allPoints = [...layout.bumpers, ...layout.pegs, ...layout.spinners, ...layout.lanes];
  const inBounds = allPoints.every((point) =>
    point.x >= -BOARD_HALF_WIDTH + 0.55 &&
    point.x <= BOARD_HALF_WIDTH - 0.55 &&
    point.z >= -BOARD_HALF_HEIGHT + 0.55 &&
    point.z <= BOARD_HALF_HEIGHT - 0.55,
  );
  const separated = layout.bumpers.every((bumper, index) =>
    layout.bumpers.slice(index + 1).every((other) =>
      Math.hypot(bumper.x - other.x, bumper.z - other.z) >= bumper.radius + other.radius + 0.3,
    ),
  );
  return {
    valid: inBounds && separated && layout.bumpers.length >= 6 && layout.pegs.length >= 18 && layout.spinners.length >= 2,
    inBounds,
    separated,
    bumperCount: layout.bumpers.length,
    pegCount: layout.pegs.length,
    spinnerCount: layout.spinners.length,
  };
};
