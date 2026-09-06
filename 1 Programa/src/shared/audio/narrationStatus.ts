export type NarrationStatus = "idle" | "loading" | "playing" | "error" | "browser";

let status: NarrationStatus = "idle";
let detail = "";
const listeners = new Set<() => void>();
export const getNarrationStatus = () => status;
export const getNarrationDetail = () => detail;
export const subscribeNarrationStatus = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const setNarrationStatus = (next: NarrationStatus, message = "") => {
  if (next === status && message === detail) return;
  status = next;
  detail = message;
  listeners.forEach((listener) => listener());
};
