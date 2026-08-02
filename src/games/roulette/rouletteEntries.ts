import type { RouletteEntry } from "../../core/types";

export const arrangeEliminationEntries = (
  participantEntries: RouletteEntry[],
): RouletteEntry[] => {
  const totalEntries = participantEntries.length + 2;
  const specialStart = participantEntries.length + 1;
  const orderedEntries = new Array<RouletteEntry>(totalEntries);
  const oppositeIndex = Math.round(totalEntries / 2);

  orderedEntries[0] = {
    id: "special-even",
    kind: "parity",
    label: "PAR",
    color: "#09dfdf",
    number: specialStart,
    participantId: null,
    parity: "even",
  };
  orderedEntries[oppositeIndex] = {
    id: "special-odd",
    kind: "parity",
    label: "IMPAR",
    color: "#f3b52c",
    number: specialStart + 1,
    participantId: null,
    parity: "odd",
  };

  let participantIndex = 0;
  for (let index = 0; index < orderedEntries.length; index += 1) {
    if (!orderedEntries[index]) {
      orderedEntries[index] = participantEntries[participantIndex];
      participantIndex += 1;
    }
  }

  return orderedEntries;
};
