import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateUpdateProgress, formatUpdateBytes } from "../src/shared/update/updateProgress.ts";
import { installSignedUpdate, type UpdateWorkflowState } from "../src/shared/update/updateWorkflow.ts";
import { UPDATE_RECEIPT_KEY, clearUpdateReceipt, confirmUpdateReceipt, readUpdateReceipt, writeUpdateReceipt } from "../src/shared/update/updateReceipt.ts";
import { describeUpdateFailure, downloadTelemetry, updateStepIndex } from "../src/shared/update/updatePresentation.ts";

const readText = (path: string) => readFileSync(path, "utf8").replace(/^\uFEFF/u, "");
const updaterSource = readText("src/shared/components/AppUpdater.tsx");
const workflowSource = readText("src/shared/update/updateWorkflow.ts");
const appSource = readText("src/App.tsx");
const tauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
const capability = JSON.parse(readText("src-tauri/capabilities/default.json"));

assert.equal(calculateUpdateProgress(25, 100), 25);
assert.equal(calculateUpdateProgress(150, 100), 100);
assert.equal(calculateUpdateProgress(-25, 100), 0);
assert.equal(calculateUpdateProgress(1, 0), null);
assert.equal(formatUpdateBytes(1024 * 1024), "1.0 MB");
assert.equal(formatUpdateBytes(25 * 1024 * 1024), "25 MB");

const successfulStates: UpdateWorkflowState[] = [];
let installCalls = 0;
let relaunchCalls = 0;
await installSignedUpdate({
  async download(onEvent, options) {
    assert.equal(options?.timeout, 1_200_000);
    onEvent?.({ event: "Started", data: { contentLength: 100 } });
    onEvent?.({ event: "Progress", data: { chunkLength: 25 } });
    onEvent?.({ event: "Progress", data: { chunkLength: 75 } });
    onEvent?.({ event: "Finished" });
  },
  async install() {
    installCalls += 1;
  },
}, (state) => successfulStates.push(state), async () => {
  relaunchCalls += 1;
}, async (milliseconds) => {
  assert.equal(milliseconds, 350);
});

assert.equal(installCalls, 1);
assert.equal(relaunchCalls, 1);
assert.deepEqual(successfulStates.map(({ phase }) => phase), [
  "downloading",
  "downloading",
  "downloading",
  "downloading",
  "verifying",
  "preparing",
  "installing",
  "restarting",
]);
const finalSuccessfulState = successfulStates[successfulStates.length - 1];
assert.equal(finalSuccessfulState?.progress, null, "No inventar un porcentaje de instalación/reinicio.");
assert.equal(finalSuccessfulState?.downloadedBytes, 100);
assert.equal(finalSuccessfulState?.signatureVerified, true);
assert.ok(successfulStates.filter(state => state.phase === "downloading" || state.phase === "verifying").every(state => !state.signatureVerified));

// A native signature check may take time after the last byte. Do not advance
// the UI or invoke install until download() actually resolves successfully.
let releaseSignature: () => void = () => undefined;
const signatureGate = new Promise<void>(resolve => { releaseSignature = resolve; });
const pendingSignatureStates: UpdateWorkflowState[] = [];
let pendingSignatureInstalls = 0;
const pendingSignatureFlow = installSignedUpdate({
  async download(onEvent) { onEvent?.({ event: "Finished" }); await signatureGate; },
  async install() { pendingSignatureInstalls++; },
}, state => pendingSignatureStates.push(state), async () => undefined, async () => undefined);
assert.equal(pendingSignatureStates[pendingSignatureStates.length - 1].phase, "verifying");
assert.equal(pendingSignatureInstalls, 0);
assert.ok(pendingSignatureStates.every(state => !state.signatureVerified));
releaseSignature();
await pendingSignatureFlow;
assert.equal(pendingSignatureInstalls, 1);

const unknownSizeStates: UpdateWorkflowState[] = [];
await installSignedUpdate({
  async download(onEvent) {
    onEvent?.({ event: "Started", data: {} });
    for (const chunkLength of [-1, Number.NaN, Number.POSITIVE_INFINITY, 50]) onEvent?.({ event: "Progress", data: { chunkLength } });
    onEvent?.({ event: "Finished" });
  },
  async install() {},
}, state => unknownSizeStates.push(state), async () => undefined, async () => undefined);
assert.ok(unknownSizeStates.filter(state => state.phase === "downloading").every(state => state.progress === null && state.totalBytes === 0));
assert.equal(unknownSizeStates[unknownSizeStates.length - 1].downloadedBytes, 50);

let receiptWritten = false;
await installSignedUpdate({
  async download(onEvent) { onEvent?.({ event: "Finished" }); },
  async install() { assert.equal(receiptWritten, true, "Guardar el estado ANTES de que Windows cierre el proceso."); },
}, () => undefined, async () => undefined, async () => undefined, async () => { receiptWritten = true; });

for (const failure of ["signature", "truncated", "receipt", "install", "restart"]) {
  let applied = 0;
  let relaunched = 0;
  const states: UpdateWorkflowState[] = [];
  await assert.rejects(installSignedUpdate({
    async download(onEvent) {
      onEvent?.({ event: "Started", data: { contentLength: 100 } });
      onEvent?.({ event: "Progress", data: { chunkLength: failure === "truncated" ? 60 : 100 } });
      onEvent?.({ event: "Finished" });
      if (failure === "signature") throw new Error("signature invalid");
    },
    async install() { applied++; if (failure === "install") throw new Error("installation failed"); },
  }, state => states.push(state), async () => { relaunched++; throw new Error("restart failed"); }, async () => undefined,
  async () => { if (failure === "receipt") throw new Error("storage failed"); }));
  assert.equal(applied, failure === "install" || failure === "restart" ? 1 : 0);
  assert.equal(relaunched, failure === "restart" ? 1 : 0);
  if (failure === "signature") assert.ok(states.every(state => !state.signatureVerified), "Finished no confirma una firma.");
}

const memory = new Map<string, string>();
const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
const now = Date.now();
const receipt = { from: "1.0.10", to: "1.0.11", startedAt: now };
writeUpdateReceipt(storage, receipt);
assert.deepEqual(readUpdateReceipt(storage, now), receipt);
assert.equal(confirmUpdateReceipt(receipt, "1.0.11"), "complete");
assert.equal(confirmUpdateReceipt(receipt, "1.0.12"), "complete");
assert.equal(confirmUpdateReceipt(receipt, "1.0.10"), "interrupted");
assert.equal(confirmUpdateReceipt(receipt, "invalid"), "interrupted");
assert.equal(readUpdateReceipt(storage, now + 8 * 86400000), null);
assert.equal(readUpdateReceipt(storage, now - 120000), null);
clearUpdateReceipt(storage);
assert.equal(readUpdateReceipt(storage), null);
for (const corrupt of ["broken", "null", "[]", "{}", JSON.stringify({ ...receipt, to: "https://other-site/package.exe" }), JSON.stringify({ ...receipt, startedAt: "today" })]) {
  memory.set(UPDATE_RECEIPT_KEY, corrupt);
  assert.equal(readUpdateReceipt(storage), null);
}
assert.throws(() => writeUpdateReceipt({ ...storage, setItem: () => { throw new Error("full"); } }, receipt), /guardar el estado/u);
assert.throws(() => writeUpdateReceipt({ ...storage, getItem: () => null }, receipt), /guardar el estado/u);
assert.equal(downloadTelemetry(0, 1000, 0), null);
assert.equal(downloadTelemetry(1024 * 1024, 2 * 1024 * 1024, 2000)?.remaining, "aprox. 2 s restantes");
assert.equal(downloadTelemetry(1024, 0, 2000)?.remaining, null);
assert.equal(updateStepIndex("complete"), 5);
assert.equal(updateStepIndex("verifying"), 2);
assert.match(describeUpdateFailure("invalid signature", "verifying"), /no se aplicó/u);

let failedInstallCalls = 0;
await assert.rejects(
  installSignedUpdate({
    async download() {
      throw new Error("descarga simulada interrumpida");
    },
    async install() {
      failedInstallCalls += 1;
    },
  }, () => undefined, async () => undefined, async () => undefined),
  /descarga simulada interrumpida/u,
);
assert.equal(failedInstallCalls, 0, "Nunca debe instalarse una descarga incompleta.");

for (const marker of [
  "check({ timeout: 8_000 })",
  "update.currentVersion",
  "installSignedUpdate(update",
  "changeStatus(state.phase)",
  "ACTUALIZACIÓN AUTOMÁTICA SEGURA",
  "visible && !blocked",
  "navigator.onLine",
  "Comprobación automática aplazada",
  "element?.showModal()",
  'element?.addEventListener("cancel", cancel)',
  'element?.addEventListener("keydown", keydown, true)',
  "confirmUpdateReceipt(receipt, actualVersion)",
  "await getVersion()",
  "writeUpdateReceipt(localStorage",
  "bootCompleteRef.current",
  "await checkForUpdate(true)",
  "setFailurePhase",
  "data-signature-verified",
]) {
  assert.ok(updaterSource.includes(marker), `Falta el contrato de actualización automática: ${marker}.`);
}

for (const marker of [
  "await update.download(",
  "await update.install()",
  "await relaunchApp()",
  "timeout: 1_200_000",
]) {
  assert.ok(workflowSource.includes(marker), `Falta el paso seguro del instalador: ${marker}.`);
}

assert.ok(!updaterSource.includes("Actualizar ahora"), "La actualización nueva no debe depender de un botón manual.");
assert.ok(!updaterSource.includes("Más tarde"), "Una actualización detectada debe comenzar automáticamente.");
assert.ok(appSource.includes("startupUpdateCheckComplete"), "El tutorial debe esperar la comprobación inicial de versión.");
assert.ok(appSource.includes("onStartupCheckComplete={completeStartupUpdateCheck}"));
assert.deepEqual(capability.permissions.includes("updater:default"), true);
assert.deepEqual(capability.permissions.includes("process:default"), true);
assert.ok(!capability.permissions.includes("core:window:allow-destroy"), "No ampliar permisos nativos para el aviso de actualización.");
assert.ok(!updaterSource.includes("getCurrentWindow().onCloseRequested"), "No interceptar la X sin permiso para completar el cierre nativo.");
assert.equal(tauriConfig.bundle.createUpdaterArtifacts, true);
assert.equal(tauriConfig.plugins.updater.windows.installMode, "quiet", "La actualización automática no debe abrir la UI de NSIS.");
assert.equal(tauriConfig.bundle.windows.nsis.installMode, "currentUser", "No ampliar privilegios para actualizar silenciosamente.");
assert.match(tauriConfig.plugins.updater.endpoints[0], /github\.com\/OscarD0823\/Fortuna-Real\/releases\/latest\/download\/latest\.json/u);

console.log(JSON.stringify({
  checkOnEveryLaunch: true,
  automaticSignedDownload: true,
  visibleProgress: true,
  silentInstall: true,
  verifiedSignaturePhase: true,
  actualVersionConfirmedAfterRestart: true,
  interruptedUpdateDetected: true,
  honestDownloadTelemetry: true,
  offlineStartupAllowed: true,
  gameInterruptionGuard: true,
  successfulWorkflowSimulated: true,
  incompleteDownloadRejected: true,
  status: "passed",
}));
