import { getMarbleProgress, type PreparedMarbleRace } from "./marbleRaceEngine.ts";

/** A delayed frame cannot invent later finishes or reorder marbles already home. */
export const createMarbleStandings = (race: PreparedMarbleRace, elapsedMs: number) => {
  const raceTime = Math.max(0, Math.min(elapsedMs, race.selected.durationMs));
  return race.racers.map(racer => {
    const state = getMarbleProgress(racer, raceTime, race.track);
    return {
      racer,
      progress: state.progress,
      finished: state.finished,
      powerActive: state.powerActive,
      incomingPowerActive: state.incomingPowerActive,
      activePower: state.activePower,
      activeTrackEvent: state.activeTrackEvent,
      recovering: state.recovering,
    };
  }).sort((first, second) => {
    if (first.finished && second.finished) return first.racer.durationMs - second.racer.durationMs || first.racer.number - second.racer.number;
    if (first.finished !== second.finished) return first.finished ? -1 : 1;
    return second.progress - first.progress || first.racer.number - second.racer.number;
  }).map((item, index) => ({ ...item, position: index + 1 }));
};

export type MarbleStanding = ReturnType<typeof createMarbleStandings>[number];
