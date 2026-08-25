import type { RouletteEntry } from "../src/core/types.ts";
import {
  UINT32_RANGE,
  acceptedUint32Range,
  commitRouletteParticipant,
  uniformIndexFromUint32,
} from "../src/games/roulette/rouletteCommitment.ts";
import { sha256Hex } from "../src/shared/crypto/sha256.ts";

if (sha256Hex("abc") !== "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad") {
  throw new Error("La implementación SHA-256 no coincide con el vector estándar abc.");
}
import {
  createDuckCommittedOrder,
  createDuckCommittedOrderFromSeed,
  createDuckCommitmentSeed,
  sealDuckCommittedOrder,
  serializeDuckCommittedOrder,
} from "../src/games/ducks/duckCommitment.ts";

const deterministicUint32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state;
  };
};

let rouletteChecks = 0;
let duckChecks = 0;

for (let count = 2; count <= 200; count += 1) {
  const acceptedRange = acceptedUint32Range(count);
  if (acceptedRange % count !== 0 || acceptedRange > UINT32_RANGE) {
    throw new Error(`El rango aceptado no reparte exactamente ${count} opciones.`);
  }

  for (let index = 0; index < count; index += 1) {
    if (uniformIndexFromUint32(count, () => index) !== index) {
      throw new Error(`El índice ${index}/${count} no es alcanzable directamente.`);
    }
  }

  if (acceptedRange < UINT32_RANGE) {
    const values = [acceptedRange, count - 1];
    if (uniformIndexFromUint32(count, () => values.shift() ?? 0) !== count - 1) {
      throw new Error(`El rechazo de cola falló para ${count} opciones.`);
    }
  }

  const entries: RouletteEntry[] = Array.from({ length: count }, (_, index) => ({
    id: `entry-${index}`,
    kind: "participant",
    label: `Participante ${index + 1}`,
    color: "#ffffff",
    number: index + 1,
    participantId: `p-${index}`,
    parity: (index + 1) % 2 === 0 ? "even" : "odd",
  }));
  entries.splice(1, 0, {
    id: "visual-parity",
    kind: "parity",
    label: "PAR",
    color: "#000000",
    number: 0,
    participantId: null,
    parity: "even",
  });
  for (let index = 0; index < count; index += 1) {
    const selected = commitRouletteParticipant(entries, () => index);
    if (selected.participantId !== `p-${index}` || selected.kind !== "participant") {
      throw new Error(`Ruleta incluyó presentación de paridad para ${count}/${index}.`);
    }
  }
  rouletteChecks += count;

  const ids = Array.from({ length: count }, (_, index) => `duck-${index}`);
  const order = createDuckCommittedOrder(ids, deterministicUint32(count), `nonce-${count}`);
  const repeated = createDuckCommittedOrder(ids, deterministicUint32(count), `nonce-${count}`);
  if (serializeDuckCommittedOrder(order) !== serializeDuckCommittedOrder(repeated)) {
    throw new Error(`El orden comprometido no fue determinista con fuente inyectada (${count}).`);
  }
  if (
    !ids.includes(order.survivorId)
    || order.eliminationOrder.length !== count - 1
    || new Set(order.eliminationOrder).size !== count - 1
    || order.eliminationOrder.includes(order.survivorId)
    || order.hitOrder.length !== (count - 1) * 3
  ) {
    throw new Error(`Estructura de Patos inválida para ${count} participantes.`);
  }
  for (const id of ids) {
    const hitCount = order.hitOrder.filter((candidate) => candidate === id).length;
    const expected = id === order.survivorId ? 0 : 3;
    if (hitCount !== expected) {
      throw new Error(`${id} recibió ${hitCount} impactos; se esperaban ${expected}.`);
    }
  }
  const sealed = await sealDuckCommittedOrder(order);
  const sealedAgain = await sealDuckCommittedOrder(repeated);
  if (sealed.commitmentId !== sealedAgain.commitmentId || sealed.commitmentId.length !== 64) {
    throw new Error(`El sello SHA-256 de Patos no es estable para ${count}.`);
  }
  duckChecks += order.hitOrder.length;
}

for (const count of [2, 50, 200]) {
  const ids = Array.from({ length: count }, (_, index) => `recoverable-duck-${index}`);
  const seed = createDuckCommitmentSeed();
  const first = await createDuckCommittedOrderFromSeed(ids, seed);
  const recovered = await createDuckCommittedOrderFromSeed(ids, seed);
  if (serializeDuckCommittedOrder(first) !== serializeDuckCommittedOrder(recovered)) {
    throw new Error(`No se recuperó exactamente el compromiso AES-CTR para ${count}.`);
  }
}

console.log(JSON.stringify({
  participantCounts: "2..200",
  exactRangeProof: "acceptedRange % count === 0",
  rouletteReachabilityChecks: rouletteChecks,
  duckCommittedHitsChecked: duckChecks,
  cryptographicSeal: "SHA-256",
  recoverableCSPRNG: "AES-CTR/256",
  status: "passed",
}, null, 2));
