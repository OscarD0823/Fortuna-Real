import {
  secureUint32,
  uniformIndexFromUint32,
  type Uint32Source,
} from "../roulette/rouletteCommitment.ts";

export interface DuckCommittedOrder {
  nonce: string;
  survivorId: string;
  eliminationOrder: string[];
  hitOrder: string[];
}

export interface DuckCommitment extends DuckCommittedOrder {
  commitmentId: string;
}

const secureNonce = () => {
  const values = new Uint32Array(8);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
};

export const createDuckCommitmentSeed = secureNonce;

export const shuffleCommittedIds = (
  participantIds: readonly string[],
  drawUint32: Uint32Source = secureUint32,
) => {
  const shuffled = [...participantIds];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = uniformIndexFromUint32(index + 1, drawUint32);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

/**
 * Precalcula toda la partida. Cada no superviviente recibe exactamente tres
 * impactos; el clic solo consume el siguiente identificador de hitOrder.
 */
export const createDuckCommittedOrder = (
  participantIds: readonly string[],
  drawUint32: Uint32Source = secureUint32,
  nonce = secureNonce(),
): DuckCommittedOrder => {
  const uniqueIds = Array.from(new Set(participantIds));
  if (uniqueIds.length !== participantIds.length || uniqueIds.length < 2) {
    throw new Error("Patos requiere entre participantes únicos y al menos dos nombres.");
  }

  const decisionOrder = shuffleCommittedIds(uniqueIds, drawUint32);
  const survivorId = decisionOrder[decisionOrder.length - 1];
  const eliminationOrder = decisionOrder.slice(0, -1);
  const hitOrder = [
    ...shuffleCommittedIds(eliminationOrder, drawUint32),
    ...shuffleCommittedIds(eliminationOrder, drawUint32),
    ...eliminationOrder,
  ];

  return { nonce, survivorId, eliminationOrder, hitOrder };
};

export const serializeDuckCommittedOrder = (order: DuckCommittedOrder) => JSON.stringify({
  version: 1,
  nonce: order.nonce,
  survivorId: order.survivorId,
  eliminationOrder: order.eliminationOrder,
  hitOrder: order.hitOrder,
});

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");

export const sealDuckCommittedOrder = async (
  order: DuckCommittedOrder,
): Promise<DuckCommitment> => {
  const input = new TextEncoder().encode(serializeDuckCommittedOrder(order));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return { ...order, commitmentId: bytesToHex(new Uint8Array(digest)) };
};

const hexToBytes = (hex: string) => {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("La semilla comprometida debe contener 256 bits en hexadecimal.");
  }
  return new Uint8Array(hex.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
};

/**
 * Reconstruye la misma fuente CSPRNG AES-CTR desde una semilla de 256 bits.
 * Permite recuperar una ronda persistida sin volver a decidir el superviviente.
 */
export const createDuckCommittedOrderFromSeed = async (
  participantIds: readonly string[],
  seed: string,
) => {
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(seed),
    { name: "AES-CTR" },
    false,
    ["encrypt"],
  );
  const stream = await crypto.subtle.encrypt(
    { name: "AES-CTR", counter: new Uint8Array(16), length: 64 },
    key,
    new Uint8Array(65_536),
  );
  const values = new DataView(stream);
  let cursor = 0;
  const drawUint32 = () => {
    if (cursor * 4 >= values.byteLength) throw new Error("La fuente AES-CTR agotó su reserva.");
    const value = values.getUint32(cursor * 4, true);
    cursor += 1;
    return value;
  };
  return createDuckCommittedOrder(participantIds, drawUint32, seed);
};

export const createSealedDuckCommitmentFromSeed = async (
  participantIds: readonly string[],
  seed: string,
) => sealDuckCommittedOrder(await createDuckCommittedOrderFromSeed(participantIds, seed));
