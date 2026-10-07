import type { GameId } from "./types";

// Pinball is retained only in persisted types and historical results.
export type PlayableGameId = Exclude<GameId, "pinball">;
export const isGamePlayable = (game: GameId): game is PlayableGameId => game !== "pinball";
