export const UPDATE_RECEIPT_KEY = "fortuna-real.pending-update.v1";
const MAX_RECEIPT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface UpdateReceipt {
  from: string;
  to: string;
  startedAt: number;
}

const stableVersion = (value: unknown): value is string => typeof value === "string"
  && /^\d{1,5}\.\d{1,5}\.\d{1,5}$/u.test(value);

export function readUpdateReceipt(storage: StorageAccess, now = Date.now()): UpdateReceipt | null {
  try {
    const raw = storage.getItem(UPDATE_RECEIPT_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const receipt = value as Partial<UpdateReceipt>;
    if (!stableVersion(receipt.from) || !stableVersion(receipt.to) || receipt.from === receipt.to
      || typeof receipt.startedAt !== "number" || !Number.isFinite(receipt.startedAt)
      || receipt.startedAt > now + 60_000 || now - receipt.startedAt > MAX_RECEIPT_AGE_MS) return null;
    return { from: receipt.from, to: receipt.to, startedAt: receipt.startedAt };
  } catch { return null; }
}

export function writeUpdateReceipt(storage: StorageAccess, receipt: UpdateReceipt) {
  if (!stableVersion(receipt.from) || !stableVersion(receipt.to) || receipt.from === receipt.to || !Number.isFinite(receipt.startedAt)) {
    throw new Error("La información de la nueva versión no es válida. No se aplicaron cambios.");
  }
  try {
    storage.setItem(UPDATE_RECEIPT_KEY, JSON.stringify(receipt));
    const saved = readUpdateReceipt(storage, receipt.startedAt);
    if (!saved || saved.from !== receipt.from || saved.to !== receipt.to || saved.startedAt !== receipt.startedAt) throw new Error("receipt mismatch");
  } catch {
    throw new Error("No se pudo guardar el estado del reinicio. Libera espacio y vuelve a intentarlo; aún no se reemplazó el programa.");
  }
}

export function clearUpdateReceipt(storage: StorageAccess) {
  try { storage.removeItem(UPDATE_RECEIPT_KEY); } catch { /* Storage failures must not prevent opening the app. */ }
}

/** UI evidence only: this receipt never grants installation authority. */
export function confirmUpdateReceipt(receipt: UpdateReceipt, actualVersion: string): "complete" | "interrupted" {
  if (!stableVersion(actualVersion)) return "interrupted";
  const actual = actualVersion.split(".").map(Number);
  const target = receipt.to.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (actual[i] > target[i]) return "complete";
    if (actual[i] < target[i]) return "interrupted";
  }
  return "complete";
}
