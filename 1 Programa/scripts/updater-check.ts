import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateUpdateProgress, formatUpdateBytes } from "../src/shared/update/updateProgress.ts";
import { installSignedUpdate, type UpdateWorkflowState } from "../src/shared/update/updateWorkflow.ts";

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
    assert.equal(options?.timeout, 180_000);
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
  "downloading",
  "installing",
  "restarting",
]);
const finalSuccessfulState = successfulStates[successfulStates.length - 1];
assert.equal(finalSuccessfulState?.progress, 100);
assert.equal(finalSuccessfulState?.downloadedBytes, 100);

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
  "setStatus(state.phase)",
  "ACTUALIZACIÓN AUTOMÁTICA SEGURA",
  "Actualizando Fortuna Real",
  "visible && !blocked",
  "navigator.onLine",
  "Comprobación automática aplazada",
]) {
  assert.ok(updaterSource.includes(marker), `Falta el contrato de actualización automática: ${marker}.`);
}

for (const marker of [
  "await update.download(",
  "await update.install()",
  "await relaunchApp()",
  "timeout: 180_000",
]) {
  assert.ok(workflowSource.includes(marker), `Falta el paso seguro del instalador: ${marker}.`);
}

assert.ok(!updaterSource.includes("Actualizar ahora"), "La actualización nueva no debe depender de un botón manual.");
assert.ok(!updaterSource.includes("Más tarde"), "Una actualización detectada debe comenzar automáticamente.");
assert.ok(appSource.includes("startupUpdateCheckComplete"), "El tutorial debe esperar la comprobación inicial de versión.");
assert.ok(appSource.includes("onStartupCheckComplete={completeStartupUpdateCheck}"));
assert.deepEqual(capability.permissions.includes("updater:default"), true);
assert.deepEqual(capability.permissions.includes("process:default"), true);
assert.equal(tauriConfig.bundle.createUpdaterArtifacts, true);
assert.equal(tauriConfig.plugins.updater.windows.installMode, "passive");
assert.match(tauriConfig.plugins.updater.endpoints[0], /github\.com\/OscarD0823\/Fortuna-Real\/releases\/latest\/download\/latest\.json/u);

console.log(JSON.stringify({
  checkOnEveryLaunch: true,
  automaticSignedDownload: true,
  visibleProgress: true,
  passiveInstall: true,
  offlineStartupAllowed: true,
  gameInterruptionGuard: true,
  successfulWorkflowSimulated: true,
  incompleteDownloadRejected: true,
  status: "passed",
}));
