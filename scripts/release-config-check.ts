import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const readText = (path: string) => readFileSync(path, "utf8").replace(/^\uFEFF/u, "");
const packageJson = JSON.parse(readText("package.json"));
const packageLock = JSON.parse(readText("package-lock.json"));
const tauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
const cargoToml = readText("src-tauri/Cargo.toml");
const cargoLock = readText("src-tauri/Cargo.lock");
const workflow = readText(".github/workflows/release.yml");
const launcher = readText("iniciar-fortuna.ps1");
const updaterUi = readText("src/shared/components/AppUpdater.tsx");
const installerCreator = readText("crear-instalador.ps1");
const githubStarter = readText("iniciador/instalar-desde-github.ps1");

const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/mu)?.[1];
assert.equal(packageJson.version, tauriConfig.version, "package.json y Tauri deben coincidir.");
assert.equal(packageJson.version, cargoVersion, "package.json y Cargo deben coincidir.");
assert.equal(packageLock.version, packageJson.version, "package-lock.json debe conservar la versión de la aplicación.");
assert.equal(packageLock.packages[""].version, packageJson.version);
assert.equal(cargoLock.match(/name = "fortuna-real"\s+version = "([^"]+)"/u)?.[1], packageJson.version);
assert.equal(tauriConfig.bundle?.targets, "nsis");
assert.equal(tauriConfig.bundle?.createUpdaterArtifacts, true);
assert.deepEqual(tauriConfig.bundle?.windows?.webviewInstallMode, { type: "offlineInstaller", silent: true }, "Otro PC debe poder instalar WebView2 sin descargarlo.");
assert.equal(tauriConfig.bundle?.windows?.nsis?.installMode, "currentUser", "El programa debe instalarse para el usuario sin requerir herramientas de desarrollo.");
assert.equal(tauriConfig.bundle?.windows?.nsis?.installerHooks, "windows/installer-hooks.nsh", "El instalador debe crear el acceso exterior del escritorio.");
assert.ok(readText("src-tauri/windows/installer-hooks.nsh").includes("CreateOrUpdateDesktopShortcut"));
assert.equal(tauriConfig.build?.frontendDist, "../dist", "El instalador debe incluir el frontend compilado.");

const updater = tauriConfig.plugins?.updater;
assert.equal(typeof updater?.pubkey, "string");
assert.ok(updater.pubkey.length > 80, "Falta la clave pública del actualizador.");
assert.equal(updater.endpoints?.length, 1, "Debe existir un único endpoint canónico.");
assert.match(updater.endpoints[0], /^https:\/\/github\.com\//u);

let signedLocalArtifacts = false;
if (process.env.CI !== "true" && existsSync("instaladores/latest.json")) {
  const latestManifest = JSON.parse(readText("instaladores/latest.json"));
  if (latestManifest.version === packageJson.version) {
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
  } else {
    assert.match(String(latestManifest.version ?? ""), /^\d+\.\d+\.\d+$/u, "El manifiesto local anterior tiene una versión inválida.");
  }
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
for (const marker of [
  "npm.cmd ci",
  "npm.cmd test",
  "cargo.exe clippy",
  ".password.dpapi",
  ".fortuna-cache",
  "signer sign",
  "maximumPasswordAttempts",
  "ProtectedData]::Protect",
  "ProtectedData]::Unprotect",
  "$env:TAURI_SIGNING_PRIVATE_KEY = $SigningKeyPath",
  "Start-Process -FilePath \"explorer.exe\"",
  "--example verify_installer",
]) {
  assert.ok(installerCreator.includes(marker), `El creador local no aplica la puerta segura: ${marker}.`);
}
assert.ok(!installerCreator.includes("$SigningKeyPath.password\""), "No debe conservarse la contraseña de firma en texto plano.");
assert.ok(installerCreator.indexOf("& npm.cmd ci") < installerCreator.indexOf("signer sign"), "Las dependencias deben estar instaladas antes de probar la firma.");
assert.ok(updaterUi.includes("navigator.onLine"), "El actualizador debe respetar el estado sin conexión.");
assert.ok(updaterUi.includes("Comprobación automática aplazada"), "La comprobación automática debe fallar sin interrumpir el arranque.");
assert.ok(!updaterUi.includes("Actualizaciones no comprobadas"), "El arranque no debe mostrar una falsa alarma de conexión.");
assert.ok(updaterUi.includes("visible && !blocked"), "Las actualizaciones deben esperar al cierre de las guías y partidas.");
const signatureVerifier = readText("src-tauri/examples/verify_installer.rs");
for (const marker of ["PublicKey::decode", "verify_stream", "verifier.finalize()", "include_str!(\"../tauri.conf.json\")"]) {
  assert.ok(signatureVerifier.includes(marker), `Falta la validación criptográfica del instalador: ${marker}.`);
}
for (const marker of [
  '"Entrega"',
  '"1 Programa"',
  '"2 Instaladores"',
  '"3 Ejecutar"',
  "ZipFile]::CreateFromDirectory",
  "Fortuna-Real-$version-Iniciador.zip",
  "Fortuna-Real-Portable.exe",
  "Ejecutar Fortuna Real.cmd",
  "Instalar Fortuna Real.cmd",
  "Get-ChildItem -LiteralPath $InstallerOutput",
]) {
  assert.ok(installerCreator.includes(marker), `La entrega no prepara correctamente: ${marker}.`);
}
for (const marker of [
  '"OscarD0823/Fortuna-Real"',
  "git.exe clone",
  "--depth 1",
  '"1 Programa"',
  '"2 Instaladores"',
  '"3 Ejecutar"',
  "Invoke-WebRequest",
  "ConvertFrom-Json",
  "npm.cmd ci",
  "status --porcelain",
]) {
  assert.ok(githubStarter.includes(marker), `El iniciador de GitHub no aplica: ${marker}.`);
}
assert.ok(!githubStarter.includes("gh.exe"), "El iniciador público no debe exigir GitHub CLI ni autenticación.");

console.log(JSON.stringify({
  version: packageJson.version,
  updaterEndpoint: updater.endpoints[0],
  signedLocalArtifacts,
  cspEnabled: true,
  releaseGatesConfigured: true,
  oneClickCacheConfigured: true,
  signingPasswordPreflight: true,
  launcherKillsProcesses: false,
  automaticCheckFailureSilent: true,
  offlineWebViewBundled: true,
  distributedSignatureVerification: true,
  deliveryFolders: ["1 Programa", "2 Instaladores", "3 Ejecutar"],
  publicRepositoryStarter: true,
}));
