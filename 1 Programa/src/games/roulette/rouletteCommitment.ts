import type { RouletteEntry } from "../../core/types";
import { sha256Hex } from "../../shared/crypto/sha256.ts";

export const UINT32_RANGE = 0x1_0000_0000;

export type Uint32Source = () => number;

export const secureUint32: Uint32Source = () => {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0];
};

export const acceptedUint32Range = (choiceCount: number) => {
  if (!Number.isSafeInteger(choiceCount) || choiceCount < 1 || choiceCount > UINT32_RANGE) {
    throw new RangeError("La cantidad de opciones debe ser un entero entre 1 y 2^32.");
  }
  return UINT32_RANGE - (UINT32_RANGE % choiceCount);
};

/**
 * Selecciona un índice uniforme sin sesgo de módulo. Los valores de la cola
 * incompleta de uint32 se descartan y se pide otro valor a la fuente.
 */
export const uniformIndexFromUint32 = (
  choiceCount: number,
  drawUint32: Uint32Source = secureUint32,
) => {
  const acceptedRange = acceptedUint32Range(choiceCount);
  for (;;) {
    const value = drawUint32();
    if (!Number.isSafeInteger(value) || value < 0 || value >= UINT32_RANGE) {
      throw new RangeError("La fuente aleatoria debe devolver un uint32 válido.");
    }
    if (value < acceptedRange) return value % choiceCount;
  }
};

/**
 * Compromete a una persona real antes de animar la ruleta. Las casillas de
 * paridad pueden seguir dibujándose, pero nunca forman parte de la decisión.
 */
export const commitRouletteParticipant = (
  entries: readonly RouletteEntry[],
  drawUint32: Uint32Source = secureUint32,
) => {
  const eligible = entries.filter(
    (entry) => entry.kind === "participant" && !entry.disabled && !!entry.participantId,
  );
  if (eligible.length === 0) {
    throw new Error("No hay participantes elegibles para comprometer.");
  }
  return eligible[uniformIndexFromUint32(eligible.length, drawUint32)];
};

export const createRouletteCommitment = (entries: readonly RouletteEntry[]) => {
  const seedWords = new Uint32Array(8);
  crypto.getRandomValues(seedWords);
  const seed = Array.from(seedWords, (word) => word.toString(16).padStart(8, "0")).join("");
  let counter = 0;
  let pool: number[] = [];
  const seededUint32 = () => {
    if (pool.length === 0) {
      const digest = sha256Hex(`${seed}:${counter}`);
      counter += 1;
      pool = Array.from({ length: 8 }, (_, index) =>
        Number.parseInt(digest.slice(index * 8, index * 8 + 8), 16) >>> 0,
      );
    }
    return pool.shift() ?? 0;
  };
  const selected = commitRouletteParticipant(entries, seededUint32);
  const participantIds = entries.flatMap((entry) =>
    entry.kind === "participant" && !entry.disabled && entry.participantId
      ? [entry.participantId]
      : [],
  );
  const proof = JSON.stringify({
    version: 2,
    seed,
    participantIds,
    selectedParticipantId: selected.participantId,
    landedNumber: selected.number,
  });
  return {
    selected,
    seed,
    commitmentId: `ROU-${sha256Hex(proof).toUpperCase()}`,
  };
};
