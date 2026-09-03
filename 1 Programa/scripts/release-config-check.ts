import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";

const readText = (path: string) => readFileSync(path, "utf8").replace(/^\uFEFF/u, "");
const packageJson = JSON.parse(readText("package.json"));
const packageLock = JSON.parse(readText("package-lock.json"));
const tauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
const cargoToml = readText("src-tauri/Cargo.toml");
const cargoLock = readText("src-tauri/Cargo.lock");
const cargoConfig = readText("src-tauri/.cargo/config.toml");
const repositoryRoot = "..";
const workflow = readText(`${repositoryRoot}/.github/workflows/release.yml`);
const launcher = readText("iniciar-fortuna.ps1");
const updaterUi = readText("src/shared/components/AppUpdater.tsx");
const updaterWorkflow = readText("src/shared/update/updateWorkflow.ts");
const installerCreator = readText("crear-instalador.ps1");
const installerSpanish = readText("src-tauri/windows/Spanish.nsh");
const githubStarter = readText(`${repositoryRoot}/3 Ejecutar/Iniciador GitHub/instalar-desde-github.ps1`);
const installerUpgradeLauncher = readText(`${repositoryRoot}/3 Ejecutar/INSTALAR O ACTUALIZAR.cmd`);
const localInstallerDirectory = `${repositoryRoot}/Entrega/2 Instaladores`;
const ttsDirectory = "src-tauri/resources/tts/vits-piper-es_AR-daniela-high";

for (const requiredPath of [
  `${repositoryRoot}/1 Programa`,
  `${repositoryRoot}/2 Instaladores`,
  `${repositoryRoot}/3 Ejecutar`,
  `${repositoryRoot}/README.md`,
]) {
  assert.ok(existsSync(requiredPath), `Falta la ruta principal del repositorio: ${requiredPath}.`);
}

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
assert.equal(
  tauriConfig.bundle?.windows?.nsis?.customLanguageFiles?.Spanish,
  "windows/Spanish.nsh",
  "El instalador debe explicar claramente la actualización en español.",
);
assert.ok(readText("src-tauri/windows/installer-hooks.nsh").includes("CreateOrUpdateDesktopShortcut"));
for (const label of [
  "Actualizar directamente y conservar mis datos (recomendado)",
  "Desinstalar la versión anterior e instalar la nueva",
  "Eliminar también participantes, historial, premios y configuración",
]) {
  assert.ok(installerSpanish.includes(label), `Falta una decisión clara del instalador: ${label}.`);
}
assert.equal(tauriConfig.build?.frontendDist, "../dist", "El instalador debe incluir el frontend compilado.");
assert.ok(tauriConfig.bundle?.resources?.includes("resources/tts/"), "El instalador debe incluir la voz neuronal offline.");
assert.ok(cargoToml.includes('sherpa-onnx = { version = "=1.13.7"'), "El backend debe integrar sherpa-onnx de forma nativa y reproducible.");
assert.ok(cargoToml.includes('features = ["static"]'), "La voz debe quedar autocontenida sin DLL externas.");
assert.ok(cargoConfig.includes("target-feature=+crt-static"), "Rust y sherpa-onnx deben usar el mismo CRT en Windows.");
for (const resource of [
  `${ttsDirectory}/es_AR-daniela-high.onnx`,
  `${ttsDirectory}/tokens.txt`,
  `${ttsDirectory}/espeak-ng-data`,
  `${ttsDirectory}/MODEL_CARD`,
]) {
  assert.ok(existsSync(resource), `Falta un recurso de voz offline: ${resource}.`);
}
assert.ok(statSync(`${ttsDirectory}/es_AR-daniela-high.onnx`).size > 100_000_000, "El modelo de voz parece incompleto.");
assert.ok(existsSync("src-tauri/resources/tts/licenses/CC-BY-SA-4.0.txt"), "Falta la licencia CC BY-SA del conjunto de voz Daniela.");
assert.ok(readText("src-tauri/resources/tts/THIRD-PARTY-NOTICES.txt").includes("vits-piper-es_AR-daniela-high"), "Los avisos legales deben identificar la voz incluida.");

const updater = tauriConfig.plugins?.updater;
assert.equal(typeof updater?.pubkey, "string");
assert.ok(updater.pubkey.length > 80, "Falta la clave pública del actualizador.");
assert.equal(updater.endpoints?.length, 1, "Debe existir un único endpoint canónico.");
assert.match(updater.endpoints[0], /^https:\/\/github\.com\//u);

let signedLocalArtifacts = false;
if (process.env.CI !== "true" && existsSync(`${localInstallerDirectory}/latest.json`)) {
  const latestManifestPath = `${localInstallerDirectory}/latest.json`;
  const latestManifestBytes = readFileSync(latestManifestPath);
  const latestManifest = JSON.parse(readText(latestManifestPath));
  if (latestManifest.version === packageJson.version) {
    assert.ok(
      !(latestManifestBytes[0] === 0xEF && latestManifestBytes[1] === 0xBB && latestManifestBytes[2] === 0xBF),
      "latest.json debe estar codificado como UTF-8 sin BOM.",
    );
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
    assert.ok(existsSync(`${localInstallerDirectory}/${installerName}`), "Falta el instalador local declarado.");
    assert.ok(existsSync(`${localInstallerDirectory}/${installerName}.sig`), "Falta la firma local del instalador.");
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
  "lfs: true",
  'working-directory: "1 Programa"',
  'cache-dependency-path: "1 Programa/package-lock.json"',
  "firma local",
]) {
  assert.ok(workflow.includes(command), `El workflow no ejecuta o valida: ${command}.`);
}
const mutableActionRefs = workflow.match(/uses:\s+[^\s]+@(?![0-9a-f]{40}(?:\s|$))[^\s#]+/gu) ?? [];
assert.deepEqual(mutableActionRefs, [], `Las acciones deben fijarse por SHA: ${mutableActionRefs.join(", ")}`);
assert.ok(!workflow.includes("TAURI_SIGNING_PRIVATE_KEY"), "GitHub Actions no debe pedir la clave privada de firma local.");
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
  "Write-Utf8WithoutBom -LiteralPath $latestPath -Value $latestJson",
  "New-Object Text.UTF8Encoding($false)",
  "manifiesto remoto contiene una marca BOM",
  "Wait-ForRemoteManifest -Uri $remoteManifestUrl -ExpectedVersion $version",
  "MaximumAttempts = 48",
  "fortuna_version=$ExpectedVersion&attempt=$attempt",
  "GitHub todavía está propagando el Release",
  "$env:TAURI_SIGNING_PRIVATE_KEY = $SigningKeyPath",
  "Start-Process -FilePath \"explorer.exe\"",
  "--example verify_installer",
  "$releaseAlreadyExists = $LASTEXITCODE -eq 0",
]) {
  assert.ok(installerCreator.includes(marker), `El creador local no aplica la puerta segura: ${marker}.`);
}
assert.ok(!installerCreator.includes("$SigningKeyPath.password\""), "No debe conservarse la contraseña de firma en texto plano.");
assert.ok(installerCreator.indexOf("& npm.cmd ci") < installerCreator.indexOf("signer sign"), "Las dependencias deben estar instaladas antes de probar la firma.");
assert.ok(updaterUi.includes("navigator.onLine"), "El actualizador debe respetar el estado sin conexión.");
assert.ok(updaterUi.includes("Comprobación automática aplazada"), "La comprobación automática debe fallar sin interrumpir el arranque.");
assert.ok(!updaterUi.includes("Actualizaciones no comprobadas"), "El arranque no debe mostrar una falsa alarma de conexión.");
assert.ok(updaterUi.includes("visible && !blocked"), "Las actualizaciones deben esperar al cierre de las guías y partidas.");
assert.ok(updaterUi.includes("installSignedUpdate(update"), "La interfaz debe iniciar automáticamente el flujo firmado.");
assert.ok(updaterWorkflow.includes("await update.download("), "La versión nueva debe descargarse automáticamente.");
assert.ok(updaterWorkflow.includes("await update.install()"), "El paquete firmado debe instalarse automáticamente.");
assert.ok(updaterUi.includes("ACTUALIZACIÓN AUTOMÁTICA SEGURA"), "El usuario debe ver que Fortuna Real se está actualizando.");
assert.ok(!updaterUi.includes("Actualizar ahora"), "La actualización detectada no debe depender de una acción manual.");
const signatureVerifier = readText("src-tauri/examples/verify_installer.rs");
for (const marker of ["PublicKey::decode", "verify_stream", "verifier.finalize()", "include_str!(\"../tauri.conf.json\")", "latest.json debe ser UTF-8 sin BOM"]) {
  assert.ok(signatureVerifier.includes(marker), `Falta la validación criptográfica del instalador: ${marker}.`);
}
for (const marker of [
  '"Entrega"',
  '"1 Programa"',
  '"2 Instaladores"',
  '"3 Ejecutar"',
  "ZipFile]::CreateFromDirectory",
  "Fortuna-Real-$version-Iniciador.zip",
  "Fortuna-Real-$version-Para-Drive.zip",
  "INSTALAR O ACTUALIZAR.cmd",
  "Fortuna-Real-Portable.exe",
  "Ejecutar Fortuna Real.cmd",
  "Instalar Fortuna Real.cmd",
  "Get-ChildItem -LiteralPath $InstallerOutput",
]) {
  assert.ok(installerCreator.includes(marker), `La entrega no prepara correctamente: ${marker}.`);
}
for (const marker of [
  'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Fortuna Real"',
  '"%FORTUNA_INSTALLER%" /UPDATE',
  'start "" "%FORTUNA_INSTALLER%"',
]) {
  assert.ok(installerUpgradeLauncher.includes(marker), `El iniciador no aplica: ${marker}.`);
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
  "git.exe lfs install --skip-repo",
  "git.exe -C $DestinationPath lfs pull",
  "es_AR-daniela-high.onnx",
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
  offlineNeuralVoiceBundled: true,
}));
