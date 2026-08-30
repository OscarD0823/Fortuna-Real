export const DUCK_WAVE_SHOTS = 3;
export const DUCK_WAVE_BASE_MS = 10_000;

export type DuckArcadeMode = "single" | "double";

export const getDuckWaveSize = (mode: DuckArcadeMode) => mode === "single" ? 1 : 2;

/**
 * La ronda se vuelve más rápida de forma gradual, como un juego de puntería
 * clásico, pero nunca baja de seis segundos para seguir siendo accesible.
 */
export const getDuckWaveDuration = (waveNumber: number) =>
  Math.max(6_000, DUCK_WAVE_BASE_MS - Math.max(0, waveNumber - 1) * 180);

export const selectDuckWaveIds = (
  livingIds: readonly string[],
  waveNumber: number,
  mode: DuckArcadeMode,
) => {
  if (livingIds.length === 0) return [];
  const size = Math.min(getDuckWaveSize(mode), livingIds.length);
  const start = ((Math.max(1, waveNumber) - 1) * getDuckWaveSize(mode)) % livingIds.length;
  return Array.from({ length: size }, (_, offset) => livingIds[(start + offset) % livingIds.length]);
};

export const countDuckHitLamps = (recentHits: readonly boolean[]) =>
  recentHits.slice(-10).filter(Boolean).length;

export const getDuckPassLine = (waveNumber: number) => Math.min(9, 6 + Math.floor(Math.max(0, waveNumber - 1) / 4));
