import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const readText = (path: string) => readFileSync(path, "utf8").replace(/^\uFEFF/u, "");
const packageJson = JSON.parse(readText("package.json"));
const tauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
const cargoToml = readText("src-tauri/Cargo.toml");
const workflow = readText(".github/workflows/release.yml");
const launcher = readText("iniciar-fortuna.ps1");
const updaterUi = readText("src/shared/components/AppUpdater.tsx");
const installerCreator = readText("crear-instalador.ps1");

const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/mu)?.[1];
assert.equal(packageJson.version, tauriConfig.version, "package.json y Tauri deben coincidir.");
assert.equal(packageJson.version, cargoVersion, "package.json y Cargo deben coincidir.");

const updater = tauriConfig.plugins?.updater;
assert.equal(typeof updater?.pubkey, "string");
assert.ok(updater.pubkey.length > 80, "Falta la clave pública del actualizador.");
assert.equal(updater.endpoints?.length, 1, "Debe existir un único endpoint canónico.");
assert.match(updater.endpoints[0], /^https:\/\/github\.com\//u);

let signedLocalArtifacts = false;
if (process.env.CI !== "true" && existsSync("instaladores/latest.json")) {
  const latestManifest = JSON.parse(readText("instaladores/latest.json"));
  assert.equal(latestManifest.version, packageJson.version, "latest.json debe usar la versión actual.");
  const windowsPlatform = latestManifest.platforms?.["windows-x86_64"];
  assert.equal(typeof windowsPlatform?.signature, "string");
  assert.ok(windowsPlatform.signature.length > 100, "latest.json no contiene una firma válida.");
  assert.match(windowsPlatform.url, /^https:\/\/github\.com\//u);
  assert.ok(
    windowsPlatform.url.includes(`/releases/download/v${packageJson.version}/`),
    "El activo de latest.json no apunta al tag de la versión actual.",
  );
  const installerSegments = new URL(windowsPlatform.url).pathname.split("/");
  const installerName = decodeURIComponent(installerSegments[installerSegments.length - 1] ?? "");
  assert.ok(existsSync(`instaladores/${installerName}`), "Falta el instalador local declarado.");
  assert.ok(existsSync(`instaladores/${installerName}.sig`), "Falta la firma local del instalador.");
  signedLocalArtifacts = true;
}

const csp = tauriConfig.app?.security?.csp;
assert.equal(typeof csp, "string", "La CSP no puede estar desactivada.");
for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "connect-src"]) {
  assert.ok(csp.includes(directive), `La CSP no contiene ${directive}.`);
}
assert.ok(
  !/(?:https?|wss?):\/\/localhost(?::|\/|\s|$)/u.test(csp),
  "La CSP productiva no debe permitir servidores locales de desarrollo.",
);
assert.match(tauriConfig.app?.security?.devCsp ?? "", /localhost/u, "La CSP de desarrollo debe permitir Vite local.");

for (const command of [
  "npm run build",
  "npm test",
  "test:types",
  "cargo test",
  "cargo clippy",
  "UPDATER_ENDPOINT",
]) {
  assert.ok(workflow.includes(command), `El workflow no ejecuta o valida: ${command}.`);
}
const mutableActionRefs = workflow.match(/uses:\s+[^\s]+@(?![0-9a-f]{40}(?:\s|$))[^\s#]+/gu) ?? [];
assert.deepEqual(mutableActionRefs, [], `Las acciones deben fijarse por SHA: ${mutableActionRefs.join(", ")}`);
assert.ok(!launcher.includes("Stop-Process"), "El launcher no debe finalizar procesos por puerto.");
for (const marker of ["npm.cmd ci", "npm.cmd test", "cargo.exe clippy", ".password.dpapi"]) {
  assert.ok(installerCreator.includes(marker), `El creador local no aplica la puerta segura: ${marker}.`);
}
assert.ok(!installerCreator.includes("$SigningKeyPath.password\""), "No debe conservarse la contraseña de firma en texto plano.");
assert.ok(updaterUi.includes("navigator.onLine"), "El actualizador debe respetar el estado sin conexión.");
assert.ok(updaterUi.includes("Comprobación automática aplazada"), "La comprobación automática debe fallar sin interrumpir el arranque.");
assert.ok(!updaterUi.includes("Actualizaciones no comprobadas"), "El arranque no debe mostrar una falsa alarma de conexión.");

console.log(JSON.stringify({
  version: packageJson.version,
  updaterEndpoint: updater.endpoints[0],
  signedLocalArtifacts,
  cspEnabled: true,
  releaseGatesConfigured: true,
  launcherKillsProcesses: false,
  automaticCheckFailureSilent: true,
}));
