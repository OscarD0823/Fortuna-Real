import type { MarbleTrackEvent } from "./marbleRaceEngine.ts";

export const MARBLE_WEATHER_WARNING_MS = 1_200;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Independent seeded stream: never consumes the draw's winner/power randomness. */
export function scheduleMarbleWeather(events: readonly MarbleTrackEvent[], durationMs: number, random: () => number): MarbleTrackEvent[] {
  const shuffled = [...events];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const slotMs = durationMs * 0.67 / Math.max(1, events.length);
  return shuffled.map((event, index) => ({
    ...event,
    startsAtMs: Math.round(durationMs * 0.13 + slotMs * (index + random() * 0.16)),
    durationMs: Math.round(Math.min(5_000, slotMs * (0.59 + random() * 0.16))),
  }));
}

export function marbleWeatherEnvelope(event: MarbleTrackEvent, elapsedMs: number): number {
  if (event.startsAtMs === undefined || !event.durationMs) return 0;
  const local = (elapsedMs - event.startsAtMs) / event.durationMs;
  return local <= 0 || local >= 1 ? 0 : Math.sin(local * Math.PI) ** 2;
}

export const activeMarbleWeather = (events: readonly MarbleTrackEvent[], elapsedMs: number) =>
  events.find(event => event.startsAtMs !== undefined && elapsedMs >= event.startsAtMs
    && elapsedMs < event.startsAtMs + (event.durationMs ?? 0)) ?? null;

const weatherDrag = { freeze: 0.4, river: 0.48, tornado: 0.34, quake: 0.28 };

/** Exact integral of the smooth slowdown, independent of FPS or tab suspension. */
const weatherDelay = (events: readonly MarbleTrackEvent[], elapsedMs: number) => {
  let delay = 0;
  for (const event of events) {
    if (event.startsAtMs === undefined || !event.durationMs || elapsedMs <= event.startsAtMs) continue;
    const u = clamp01((elapsedMs - event.startsAtMs) / event.durationMs);
    const integral = event.durationMs * (u * 0.5 - Math.sin(2 * Math.PI * u) / (4 * Math.PI));
    delay += integral * Math.min(0.65, event.intensity * weatherDrag[event.type]);
  }
  return delay;
};

/** This is a draw animation: weather changes motion, not the committed result. */
export function marbleWeatherTime(events: readonly MarbleTrackEvent[], raw: number, durationMs: number): number {
  if (raw <= 0 || raw >= 1 || events[0]?.startsAtMs === undefined) return clamp01(raw);
  const total = durationMs - weatherDelay(events, durationMs);
  return clamp01((raw * durationMs - weatherDelay(events, raw * durationMs)) / Math.max(1, total));
}
