import type { StateStorage } from "zustand/middleware";

let failed = false;
const listeners = new Set<() => void>();
const report = (next: boolean) => {
  if (next === failed) return;
  failed = next;
  listeners.forEach((listener) => listener());
};
export const getDrawStorageFailure = () => failed;
export const subscribeDrawStorage = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

// A full disk / WebView quota must not throw after a winner has already been resolved.
// Keep the in-memory result available for export and make the failure visible.
export const drawStorage: StateStorage = {
  getItem(name) {
    try { return localStorage.getItem(name); }
    catch { report(true); return null; }
  },
  setItem(name, value) {
    try { localStorage.setItem(name, value); report(false); }
    catch { report(true); }
  },
  removeItem(name) {
    try { localStorage.removeItem(name); }
    catch { report(true); }
  },
};
