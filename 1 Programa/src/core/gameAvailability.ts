import type { GameId } from "./types";

export const isGamePlayable = (game: GameId) => game !== "pinball";
