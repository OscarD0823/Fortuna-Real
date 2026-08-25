import type { Participant } from "../src/core/types.ts";
import { prepareCardRound } from "../src/games/cards/cardDeck.ts";
import { preparePinballRound } from "../src/games/pinball/pinballEngine.ts";
import { prepareMarbleRace } from "../src/games/marbles/marbleRaceEngine.ts";

const makeParticipants = (count: number): Participant[] => Array.from(
  { length: count },
  (_, index) => ({
    id: `recoverable-${count}-${index}`,
    name: `Participante ${index + 1}`,
    color: `hsl(${(index * 137.508) % 360} 75% 52%)`,
  }),
);

const cardSnapshot = (participants: Participant[], seed: string) => {
  const round = prepareCardRound(participants, seed);
  return JSON.stringify({
    assigned: round.assigned.map((card) => card.participant.id),
    shuffled: round.shuffled.map((card) => card.participant.id),
    result: round.selected.participant.id,
    commitmentId: round.commitmentId,
  });
};

const pinballSnapshot = (participants: Participant[], seed: string) => {
  const round = preparePinballRound(participants, "direct", "automatic", seed);
  const launchOrder = [...round.balls]
    .sort((left, right) => left.launchDelayMs - right.launchDelayMs)
    .map((ball) => ball.participant.id);
  return JSON.stringify({
    layout: round.layout.signature,
    launchOrder,
    firstLaunch: launchOrder[0],
    balls: round.balls.map((ball) => ({
      id: ball.participant.id,
      delay: ball.launchDelayMs,
      lane: ball.laneBias,
    })),
    result: round.selected.participant.id,
    commitmentId: round.commitmentId,
  });
};

const marbleSnapshot = (participants: Participant[], seed: string) => {
  const round = prepareMarbleRace(participants, "direct", seed, "medium");
  return JSON.stringify({
    track: round.track.signature,
    order: [...round.racers]
      .sort((left, right) => left.durationMs - right.durationMs)
      .map((racer) => racer.participant.id),
    result: round.selected.participant.id,
    resultDuration: round.selected.durationMs,
  });
};

const snapshots = [
  { game: "cards", create: cardSnapshot },
  { game: "pinball", create: pinballSnapshot },
  { game: "marbles", create: marbleSnapshot },
] as const;

let deterministicChecks = 0;
let differentSeedChecks = 0;

for (let count = 2; count <= 200; count += 1) {
  const participants = makeParticipants(count);
  for (const { game, create } of snapshots) {
    const seed = `recovery-${game}-${count}-primary`;
    const first = create(participants, seed);
    const recovered = create(participants, seed);
    if (first !== recovered) {
      throw new Error(`${game} no reconstruyó exactamente la ronda para ${count} participantes.`);
    }
    deterministicChecks += 1;

    let changed = false;
    for (let attempt = 1; attempt <= 32; attempt += 1) {
      if (create(participants, `recovery-${game}-${count}-alternative-${attempt}`) !== first) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      throw new Error(`${game} no cambió asignación, orden o resultado con 32 semillas alternativas (${count}).`);
    }
    differentSeedChecks += 1;
  }
}

console.log(JSON.stringify({
  participantCounts: "2..200",
  games: ["cards", "pinball", "marbles"],
  deterministicChecks,
  differentSeedChecks,
  recovery: "same seed + participants => same assignment/layout/result",
  status: "passed",
}, null, 2));
