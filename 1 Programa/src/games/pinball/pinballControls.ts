export type PinballControl = "left" | "right" | "both";

export const pinballKeyControls: Readonly<Record<string, PinballControl>> = {
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyW: "both", ArrowUp: "both",
};

/** Each held key keeps its own ownership, including overlapping A/Left/W. */
export const getHeldPinballFlippers = (controls: Iterable<PinballControl>) => {
  let left = false;
  let right = false;
  for (const control of controls) {
    left ||= control === "left" || control === "both";
    right ||= control === "right" || control === "both";
  }
  return { left, right };
};

/** Equal mechanical response at 30, 60 and 144 Hz. */
export const getPinballFlipperBlend = (deltaSeconds: number) =>
  1 - Math.exp(-Math.max(0, Math.min(0.1, deltaSeconds)) * 23);
