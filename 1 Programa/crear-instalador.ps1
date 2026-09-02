[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$Elevated,
    [switch]$Publish,
    [switch]$FullValidation
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security
Add-Type -AssemblyName System.IO.Compression.FileSystem
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepositoryRoot = Split-Path -Parent $ProjectRoot
$DeliveryRoot = Join-Path $RepositoryRoot "Entrega"
$ProgramOutput = Join-Path $DeliveryRoot "1 Programa"
$InstallerOutput = Join-Path $DeliveryRoot "2 Instaladores"
$LauncherOutput = Join-Path $DeliveryRoot "3 Ejecutar"
$LegacyInstallerOutput = Join-Path $ProjectRoot "instaladores"
$SigningKeyPath = Join-Path $env:USERPROFILE ".tauri\fortuna-real.key"
$SigningPasswordPath = "$SigningKeyPath.password.dpapi"
$ReleaseRepository = "OscarD0823/Fortuna-Real"
$BuildCache = Join-Path $ProjectRoot ".fortuna-cache"
$DependencyStampPath = Join-Path $BuildCache "package-lock.sha256"
$ValidationStampPath = Join-Path $BuildCache "validation.sha256"

function Write-Step {
    param([string]$Message)
    Write-Host "`n  $Message" -ForegroundColor Cyan
}

function Write-Utf8WithoutBom {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][string]$Value
    )
    $encoding = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($LiteralPath, $Value, $encoding)
}

function Get-RemoteJson {
    param([Parameter(Mandatory = $true)][string]$Uri)
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 30
    $text = if ($response.Content -is [byte[]]) {
        [Text.Encoding]::UTF8.GetString($response.Content)
    } else {
        [string]$response.Content
    }
    if ($text.StartsWith([char]0xFEFF)) {
        throw "El manifiesto remoto contiene una marca BOM y no es JSON UTF-8 canónico."
    }
    return $text | ConvertFrom-Json
}

function Wait-ForRemoteManifest {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$ExpectedVersion,
        [int]$MaximumAttempts = 8,
        [int]$RetryDelaySeconds = 5
    )
    $lastFailure = "El manifiesto todavía no está disponible."
    for ($attempt = 1; $attempt -le $MaximumAttempts; $attempt++) {
        try {
            $manifest = Get-RemoteJson -Uri $Uri
            if ($manifest.version -eq $ExpectedVersion) {
                return $manifest
            }
            $lastFailure = "latest.json informa la versión $($manifest.version) en lugar de $ExpectedVersion."
        }
        catch {
            $lastFailure = $_.Exception.Message
        }

        if ($attempt -lt $MaximumAttempts) {
            Write-Host "  GitHub todavía está propagando el Release; reintento $attempt de $MaximumAttempts..." -ForegroundColor DarkGray
            Start-Sleep -Seconds $RetryDelaySeconds
        }
    }
    throw "El Release se publicó, pero su manifiesto no se propagó correctamente. Último resultado: $lastFailure"
}

function Get-DependencyFingerprint {
    # Node también admite la clave vacía de package-lock.json en PowerShell 5.1.
    $dependencyHash = & node.exe (Join-Path $ProjectRoot "scripts\dependency-fingerprint.mjs")
    if ($LASTEXITCODE -ne 0) { throw "No se pudo comprobar la huella de dependencias." }
    return $dependencyHash.Trim()
}

function Get-ValidationFingerprint {
    $inputFiles = @(
        Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "src") -File -Recurse
        Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "scripts") -File -Recurse
        Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "src-tauri\src") -File -Recurse
        Get-ChildItem -LiteralPath (Join-Path $ProjectRoot "src-tauri\examples") -File -Recurse
        Get-Item -LiteralPath $PSCommandPath
        Get-Item -LiteralPath (Join-Path $ProjectRoot "package.json")
        Get-Item -LiteralPath (Join-Path $ProjectRoot "package-lock.json")
        Get-Item -LiteralPath (Join-Path $ProjectRoot "src-tauri\Cargo.toml")
        Get-Item -LiteralPath (Join-Path $ProjectRoot "src-tauri\Cargo.lock")
        Get-Item -LiteralPath (Join-Path $ProjectRoot "src-tauri\tauri.conf.json")
    ) | Sort-Object FullName -Unique

    $fingerprintSource = ($inputFiles | ForEach-Object {
        $relativePath = $_.FullName.Substring($ProjectRoot.Length).TrimStart("\")
        $fileStream = [IO.File]::OpenRead($_.FullName)
        $fileHasher = [Security.Cryptography.SHA256]::Create()
        try {
            $fileHash = ([BitConverter]::ToString($fileHasher.ComputeHash($fileStream))).Replace("-", "")
        }
        finally {
            $fileHasher.Dispose()
            $fileStream.Dispose()
        }
        "$relativePath|$fileHash"
    }) -join "`n"
    $fingerprintBytes = [Text.Encoding]::UTF8.GetBytes($fingerprintSource)
    $fingerprintHasher = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($fingerprintHasher.ComputeHash($fingerprintBytes))).Replace("-", "")
    }
    finally {
        $fingerprintHasher.Dispose()
    }
}

function ConvertFrom-ProtectedString {
    param([Security.SecureString]$SecureValue)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Protect-LocalPassword {
    param([string]$PlainText)
    $plainBytes = [Text.Encoding]::Unicode.GetBytes($PlainText)
    try {
        $protectedBytes = [System.Security.Cryptography.ProtectedData]::Protect(
            $plainBytes,
            $null,
            [System.Security.Cryptography.DataProtectionScope]::CurrentUser
        )
        return ([BitConverter]::ToString($protectedBytes)).Replace("-", "")
    }
    finally {
        [Array]::Clear($plainBytes, 0, $plainBytes.Length)
    }
}

function Unprotect-LocalPassword {
    param([string]$ProtectedHex)
    if (-not $ProtectedHex -or $ProtectedHex.Length % 2 -ne 0 -or $ProtectedHex -notmatch '^[0-9A-Fa-f]+$') {
        throw "El archivo de contraseña protegida tiene un formato inválido."
    }
    $protectedBytes = New-Object byte[] ($ProtectedHex.Length / 2)
    for ($index = 0; $index -lt $protectedBytes.Length; $index++) {
        $protectedBytes[$index] = [Convert]::ToByte($ProtectedHex.Substring($index * 2, 2), 16)
    }
    $plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
        $protectedBytes,
        $null,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    try {
        return [Text.Encoding]::Unicode.GetString($plainBytes)
    }
    finally {
        [Array]::Clear($plainBytes, 0, $plainBytes.Length)
    }
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-VsWherePath {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe",
        "$env:ProgramFiles\Microsoft Visual Studio\Installer\vswhere.exe"
    )

    return $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

function Import-VisualStudioEnvironment {
    if (Get-Command link.exe -ErrorAction SilentlyContinue) {
        return $true
    }

    $vswhere = Get-VsWherePath
    if (-not $vswhere) {
        return $false
    }

    $installationPath = & $vswhere `
        -latest `
        -products * `
        -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
        -property installationPath

    if (-not $installationPath) {
        return $false
    }

    $developerCommand = Join-Path $installationPath "Common7\Tools\VsDevCmd.bat"
    if (-not (Test-Path -LiteralPath $developerCommand)) {
        return $false
    }

    $environmentLines = & cmd.exe /d /s /c "`"$developerCommand`" -no_logo -arch=x64 -host_arch=x64 >nul && set"
    foreach ($line in $environmentLines) {
        if ($line -match '^([^=]+)=(.*)$') {
            if ($matches[1] -ieq "PSModulePath") { continue }
            Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
        }
    }

    return [bool](Get-Command link.exe -ErrorAction SilentlyContinue)
}

function Install-WingetPackage {
    param(
        [string]$Id,
        [string]$DisplayName,
        [string]$Override = ""
    )

    Write-Step "Instalando $DisplayName..."
    $arguments = @(
        "install",
        "--id", $Id,
        "--exact",
        "--source", "winget",
        "--accept-package-agreements",
        "--accept-source-agreements"
    )

    if ($Override) {
        $arguments += @("--override", $Override)
    }
    else {
        $arguments += "--silent"
    }

    & winget.exe @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo instalar $DisplayName (codigo $LASTEXITCODE)."
    }
}

try {
    try { $Host.UI.RawUI.WindowTitle = "Fortuna Real - Crear instalador" } catch {}
    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor DarkYellow
    Write-Host "       CREAR INSTALADOR DE FORTUNA REAL" -ForegroundColor Yellow
    Write-Host "  ========================================" -ForegroundColor DarkYellow

    $hasNode = [bool](Get-Command npm.cmd -ErrorAction SilentlyContinue)
    $hasRust = [bool](Get-Command cargo.exe -ErrorAction SilentlyContinue)
    $hasNativeTools = Import-VisualStudioEnvironment
    $hasGitHubCli = [bool](Get-Command gh.exe -ErrorAction SilentlyContinue)

    Write-Host ""
    Write-Host "  Node.js:            $(if ($hasNode) { 'OK' } else { 'FALTA' })"
    Write-Host "  Rust:               $(if ($hasRust) { 'OK' } else { 'FALTA' })"
    Write-Host "  Compilador Windows: $(if ($hasNativeTools) { 'OK' } else { 'FALTA' })"
    if ($Publish) {
        Write-Host "  GitHub CLI:          $(if ($hasGitHubCli) { 'OK' } else { 'FALTA' })"
    }

    if ($CheckOnly) {
        if ($hasNode -and $hasRust -and $hasNativeTools -and (-not $Publish -or $hasGitHubCli)) { exit 0 }
        exit 2
    }

    if ($Publish -and -not $hasGitHubCli) {
        throw "Falta GitHub CLI. Instálalo con 'winget install GitHub.cli' antes de publicar."
    }

    $mustInstall = -not ($hasNode -and $hasRust -and $hasNativeTools)
    if ($mustInstall -and -not (Test-Administrator)) {
        Write-Step "Windows pedira permiso para instalar los requisitos que faltan..."
        $arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Elevated"
        if ($Publish) {
            $arguments += " -Publish"
        }
        if ($FullValidation) {
            $arguments += " -FullValidation"
        }
        $elevatedProcess = Start-Process `
            -FilePath "powershell.exe" `
            -ArgumentList $arguments `
            -WorkingDirectory $ProjectRoot `
            -Verb RunAs `
            -Wait `
            -PassThru
        exit $elevatedProcess.ExitCode
    }

    if ($mustInstall -and -not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw "Falta winget. Actualiza 'Instalador de aplicaciones' desde Microsoft Store."
    }

    if (-not $hasNode) {
        Install-WingetPackage -Id "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
        $env:Path = "$env:ProgramFiles\nodejs;$env:Path"
    }

    if (-not $hasRust) {
        Install-WingetPackage -Id "Rustlang.Rustup" -DisplayName "Rust"
        $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
        & rustup.exe default stable-msvc
        if ($LASTEXITCODE -ne 0) {
            throw "Rust se instalo, pero no se pudo activar stable-msvc."
        }
    }

    if (-not $hasNativeTools) {
        Install-WingetPackage `
            -Id "Microsoft.VisualStudio.2022.BuildTools" `
            -DisplayName "Visual Studio Build Tools para C++" `
            -Override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

        if (-not (Import-VisualStudioEnvironment)) {
            throw "Build Tools se instalo, pero Windows necesita reiniciarse. Reinicia y vuelve a abrir este creador."
        }
    }

    Set-Location -LiteralPath $ProjectRoot

    if (-not (Test-Path -LiteralPath $SigningKeyPath)) {
        throw "Falta la clave privada de actualizaciones en '$SigningKeyPath'. Restaura la copia de seguridad antes de crear una nueva version."
    }
    # Instalar antes de llamar a Tauri: una instalación nueva o interrumpida
    # puede no tener todavía disponible su ejecutable de firma.
    New-Item -ItemType Directory -Force -Path $BuildCache | Out-Null
    $packageLockHash = Get-DependencyFingerprint
    $cachedPackageLockHash = if (Test-Path -LiteralPath $DependencyStampPath) {
        (Get-Content -Raw -LiteralPath $DependencyStampPath).Trim()
    }
    else { "" }
    $dependenciesAreCurrent = (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules\.package-lock.json")) -and (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules\.bin\tauri.cmd")) -and $cachedPackageLockHash -eq $packageLockHash
    if ($dependenciesAreCurrent) {
        Write-Step "Dependencias sin cambios; reutilizando la instalacion local."
    }
    else {
        Write-Step "Actualizando dependencias (solo se repite cuando cambian los paquetes)..."
        & npm.cmd ci --prefer-offline --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci no pudo completarse. Si aparece EPERM, cierra los servidores de desarrollo que estén usando este proyecto y vuelve a intentarlo. No es necesario borrar el proyecto."
        }
        Set-Content -LiteralPath $DependencyStampPath -Value $packageLockHash -Encoding ascii
    }
    $env:TAURI_SIGNING_PRIVATE_KEY_PATH = $SigningKeyPath
    $usesProtectedPassword = Test-Path -LiteralPath $SigningPasswordPath
    $maximumPasswordAttempts = if ($usesProtectedPassword) { 1 } else { 3 }
    $passwordIsValid = $false

    for ($passwordAttempt = 1; $passwordAttempt -le $maximumPasswordAttempts; $passwordAttempt++) {
        $signingPassword = if ($usesProtectedPassword) {
            Unprotect-LocalPassword (Get-Content -Raw -LiteralPath $SigningPasswordPath).Trim()
        }
        else {
            $secureSigningPassword = Read-Host "Contrasena de la clave de firma (intento $passwordAttempt de $maximumPasswordAttempts; no se guardara)" -AsSecureString
            ConvertFrom-ProtectedString $secureSigningPassword
        }
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $signingPassword

        $signingProbePath = [IO.Path]::GetTempFileName()
        $signingProbeSignature = "$signingProbePath.sig"
        try {
            [IO.File]::WriteAllText($signingProbePath, "Fortuna Real signing key verification")
            & npm.cmd run tauri -- signer sign $signingProbePath *> $null
            $passwordIsValid = $LASTEXITCODE -eq 0
        }
        finally {
            Remove-Item -LiteralPath $signingProbePath -Force -ErrorAction SilentlyContinue
            Remove-Item -LiteralPath $signingProbeSignature -Force -ErrorAction SilentlyContinue
        }

        if ($passwordIsValid) {
            Write-Host "  Clave de firma:      OK" -ForegroundColor Green
            if (-not $usesProtectedPassword) {
                New-Item -ItemType Directory -Force -Path (Split-Path -Parent $SigningPasswordPath) | Out-Null
                Protect-LocalPassword $signingPassword | Set-Content -LiteralPath $SigningPasswordPath -Encoding ascii
                Write-Host "  Contrasena protegida con tu usuario de Windows para los proximos doble clic." -ForegroundColor DarkGray
            }
            break
        }

        Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
        if ($usesProtectedPassword) {
            throw "La contrasena protegida guardada no corresponde a la clave privada. Elimina '$SigningPasswordPath' y vuelve a intentarlo para escribirla manualmente."
        }
        Write-Host "  Contrasena incorrecta. Vuelve a intentarlo." -ForegroundColor Red
    }

    if (-not $passwordIsValid) {
        throw "La clave no pudo desbloquearse despues de $maximumPasswordAttempts intentos. No se genero ningun instalador firmado."
    }

    # Tauri 2.11 usa PRIVATE_KEY_PATH en `signer sign`, pero el empaquetador
    # de actualizaciones espera PRIVATE_KEY. Nunca deben coexistir.
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PATH -ErrorAction SilentlyContinue
    $env:TAURI_SIGNING_PRIVATE_KEY = $SigningKeyPath

    $validationFingerprint = Get-ValidationFingerprint
    $cachedValidationFingerprint = if (Test-Path -LiteralPath $ValidationStampPath) {
        (Get-Content -Raw -LiteralPath $ValidationStampPath).Trim()
    }
    else { "" }
    $requiresValidation = $Publish -or $FullValidation -or $validationFingerprint -ne $cachedValidationFingerprint
    if ($requiresValidation) {
        Write-Step "Validando los cambios del proyecto..."
        & npm.cmd run lint
        if ($LASTEXITCODE -ne 0) { throw "La comprobacion TypeScript fallo." }
        & npm.cmd test
        if ($LASTEXITCODE -ne 0) { throw "Las pruebas automatizadas fallaron." }
        & cargo.exe fmt --manifest-path "src-tauri/Cargo.toml" -- --check
        if ($LASTEXITCODE -ne 0) { throw "El formato Rust no es valido." }
        & cargo.exe test --locked --manifest-path "src-tauri/Cargo.toml"
        if ($LASTEXITCODE -ne 0) { throw "Las pruebas Rust fallaron." }
        & cargo.exe clippy --locked --manifest-path "src-tauri/Cargo.toml" --all-targets -- -D warnings
        if ($LASTEXITCODE -ne 0) { throw "Clippy encontro advertencias." }
        Set-Content -LiteralPath $ValidationStampPath -Value $validationFingerprint -Encoding ascii
    }
    else {
        Write-Step "Codigo sin cambios desde la ultima validacion; omitiendo pruebas repetidas."
    }

    Write-Step "Compilando Fortuna Real y creando el instalador..."
    $buildStartedAt = Get-Date
    & npm.cmd run tauri build
    if ($LASTEXITCODE -ne 0) {
        throw "La compilacion del instalador fallo (codigo $LASTEXITCODE)."
    }

    $installer = Get-ChildItem `
        -LiteralPath (Join-Path $ProjectRoot "src-tauri\target") `
        -Filter "*-setup.exe" `
        -File `
        -Recurse `
        -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $buildStartedAt.AddMinutes(-1) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $installer) {
        throw "La compilacion termino, pero no se encontro el archivo setup.exe."
    }

    New-Item -ItemType Directory -Force -Path $InstallerOutput | Out-Null
    $version = (Get-Content -Raw (Join-Path $ProjectRoot "src-tauri\tauri.conf.json") | ConvertFrom-Json).version
    $destination = Join-Path $InstallerOutput "Fortuna-Real-$version-Instalador.exe"
    Copy-Item -LiteralPath $installer.FullName -Destination $destination -Force

    $signatureSource = "$($installer.FullName).sig"
    if (-not (Test-Path -LiteralPath $signatureSource)) {
        throw "Se creo el instalador, pero falta su firma de actualizacion."
    }

    $signatureDestination = "$destination.sig"
    Copy-Item -LiteralPath $signatureSource -Destination $signatureDestination -Force

    $releaseTag = "v$version"
    $assetName = Split-Path -Leaf $destination
    $latestUpdate = [ordered]@{
        version = $version
        notes = "Nueva version de Fortuna Real."
        pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        platforms = [ordered]@{
            "windows-x86_64" = [ordered]@{
                signature = (Get-Content -Raw -LiteralPath $signatureSource).Trim()
                url = "https://github.com/$ReleaseRepository/releases/download/$releaseTag/$assetName"
            }
        }
    }
    $latestPath = Join-Path $InstallerOutput "latest.json"
    $latestJson = $latestUpdate | ConvertTo-Json -Depth 5
    Write-Utf8WithoutBom -LiteralPath $latestPath -Value $latestJson

    Write-Step "Verificando la firma del instalador con la clave publica de la aplicacion..."
    & cargo.exe run --release --locked --manifest-path "src-tauri/Cargo.toml" --example verify_installer -- $destination $signatureDestination $latestPath
    if ($LASTEXITCODE -ne 0) {
        throw "La firma o el manifiesto del instalador no superaron la verificacion. No distribuyas estos archivos."
    }
    Copy-Item -LiteralPath (Join-Path $ProjectRoot "INSTRUCCIONES - LEER PRIMERO.txt") -Destination $InstallerOutput -Force

    Write-Step "Preparando las tres carpetas de entrega..."
    $instructionsPath = Join-Path $InstallerOutput "INSTRUCCIONES - LEER PRIMERO.txt"
    $zipPath = Join-Path $InstallerOutput "Fortuna-Real-$version-Instalador.zip"
    $zipStage = Join-Path $BuildCache "installer-zip-stage"
    if (Test-Path -LiteralPath $zipStage) { Remove-Item -LiteralPath $zipStage -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $zipStage | Out-Null
    foreach ($zipSource in @($destination, $signatureDestination, $latestPath, $instructionsPath)) {
        Copy-Item -LiteralPath $zipSource -Destination $zipStage -Force
    }
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    [IO.Compression.ZipFile]::CreateFromDirectory(
        $zipStage,
        $zipPath,
        [IO.Compression.CompressionLevel]::Optimal,
        $false
    )
    Remove-Item -LiteralPath $zipStage -Recurse -Force

    foreach ($deliveryDirectory in @($ProgramOutput, $LauncherOutput)) {
        New-Item -ItemType Directory -Force -Path $deliveryDirectory | Out-Null
        Get-ChildItem -LiteralPath $deliveryDirectory -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
    }
    $portableSource = Join-Path $ProjectRoot "src-tauri\target\release\fortuna-real.exe"
    if (-not (Test-Path -LiteralPath $portableSource)) {
        throw "La compilación terminó sin producir el ejecutable principal para la carpeta Programa."
    }
    Copy-Item -LiteralPath $portableSource -Destination (Join-Path $ProgramOutput "Fortuna-Real-Portable.exe") -Force
    @"
FORTUNA REAL $version - PROGRAMA
================================

Abre Fortuna-Real-Portable.exe. Si Windows indica que falta WebView2 o el
programa no abre, utiliza el instalador normal de la carpeta Instaladores; ese
instalador incluye WebView2 sin conexión.

Proyecto: https://github.com/OscarD0823/Fortuna-Real
Autor: OscarD0823
"@ | Set-Content -LiteralPath (Join-Path $ProgramOutput "LEEME.txt") -Encoding utf8
    $starterStage = Join-Path $BuildCache "github-starter-stage"
    if (Test-Path -LiteralPath $starterStage) { Remove-Item -LiteralPath $starterStage -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $starterStage | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $RepositoryRoot "3 Ejecutar\Iniciador GitHub") -Force |
        Copy-Item -Destination $starterStage -Recurse -Force
    $starterZipPath = Join-Path $InstallerOutput "Fortuna-Real-$version-Iniciador.zip"
    $starterZipTemporary = Join-Path $BuildCache "Fortuna-Real-$version-Iniciador.zip"
    if (Test-Path -LiteralPath $starterZipTemporary) { Remove-Item -LiteralPath $starterZipTemporary -Force }
    [IO.Compression.ZipFile]::CreateFromDirectory(
        $starterStage,
        $starterZipTemporary,
        [IO.Compression.CompressionLevel]::Optimal,
        $false
    )
    Move-Item -LiteralPath $starterZipTemporary -Destination $starterZipPath -Force
    Remove-Item -LiteralPath $starterStage -Recurse -Force

    $portableLauncherPath = Join-Path $LauncherOutput "Ejecutar Fortuna Real.cmd"
    @"
@echo off
chcp 65001 >nul
setlocal
set "FORTUNA_EXE=%~dp0..\1 Programa\Fortuna-Real-Portable.exe"
if not exist "%FORTUNA_EXE%" (
  echo No se encontro el programa en la carpeta 1 Programa.
  pause
  exit /b 1
)
start "" "%FORTUNA_EXE%"
"@ | Set-Content -LiteralPath $portableLauncherPath -Encoding ascii

    $installerLauncherPath = Join-Path $LauncherOutput "Instalar Fortuna Real.cmd"
    @"
@echo off
chcp 65001 >nul
setlocal
set "FORTUNA_INSTALLER=%~dp0..\2 Instaladores\$(Split-Path -Leaf $destination)"
if not exist "%FORTUNA_INSTALLER%" (
  echo No se encontro el instalador en la carpeta 2 Instaladores.
  pause
  exit /b 1
)
start "" "%FORTUNA_INSTALLER%"
"@ | Set-Content -LiteralPath $installerLauncherPath -Encoding ascii
    @"
FORTUNA REAL $version - EJECUTAR
================================

- Ejecutar Fortuna Real.cmd abre la version portatil de 1 Programa.
- Instalar Fortuna Real.cmd abre el instalador normal de 2 Instaladores.
- Al instalar, Windows crea accesos fuera de la carpeta interna del programa.

Proyecto: https://github.com/OscarD0823/Fortuna-Real
"@ | Set-Content -LiteralPath (Join-Path $LauncherOutput "LEEME.txt") -Encoding utf8

    # Solo después de verificar firma, manifiesto y ZIP se retiran entregas
    # anteriores. Las rutas están ancladas a este repositorio.
    $deliveryRootFull = [IO.Path]::GetFullPath($DeliveryRoot).TrimEnd('\')
    $installerOutputFull = [IO.Path]::GetFullPath($InstallerOutput).TrimEnd('\')
    if (-not $installerOutputFull.StartsWith("$deliveryRootFull\", [StringComparison]::OrdinalIgnoreCase)) {
        throw "La carpeta de instaladores no pertenece a la entrega esperada."
    }
    $keepInstallerNames = @(
        (Split-Path -Leaf $destination),
        (Split-Path -Leaf $signatureDestination),
        (Split-Path -Leaf $latestPath),
        (Split-Path -Leaf $zipPath),
        (Split-Path -Leaf $starterZipPath),
        "INSTRUCCIONES - LEER PRIMERO.txt"
    )
    Get-ChildItem -LiteralPath $InstallerOutput -Force |
        Where-Object { $_.Name -notin $keepInstallerNames } |
        Remove-Item -Recurse -Force

    foreach ($legacyDeliveryName in @("Programa", "Instaladores", "Iniciador")) {
        $legacyDeliveryPath = Join-Path $DeliveryRoot $legacyDeliveryName
        if (Test-Path -LiteralPath $legacyDeliveryPath) {
            $legacyDeliveryFull = [IO.Path]::GetFullPath($legacyDeliveryPath).TrimEnd('\')
            $deliveryRootFull = [IO.Path]::GetFullPath($DeliveryRoot).TrimEnd('\')
            if (-not $legacyDeliveryFull.StartsWith("$deliveryRootFull\", [StringComparison]::OrdinalIgnoreCase)) {
                throw "La carpeta antigua de entrega no pertenece a la ruta permitida."
            }
            Remove-Item -LiteralPath $legacyDeliveryPath -Recurse -Force
        }
    }

    if (Test-Path -LiteralPath $LegacyInstallerOutput) {
        $legacyFull = [IO.Path]::GetFullPath($LegacyInstallerOutput).TrimEnd('\')
        $projectFull = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
        if ($legacyFull -ne "$projectFull\instaladores") {
            throw "La carpeta antigua de instaladores no coincide con la ruta permitida."
        }
        Remove-Item -LiteralPath $LegacyInstallerOutput -Recurse -Force
    }

    if ($Publish) {
        Write-Step "Comprobando acceso a GitHub..."
        & gh.exe auth status
        if ($LASTEXITCODE -ne 0) {
            throw "GitHub CLI no tiene una sesión válida. Ejecuta 'gh auth login' y vuelve a intentar."
        }

        # La ausencia del Release es el caso esperado en una publicación nueva.
        # PowerShell 7 puede convertir el stderr de un programa nativo en error
        # terminante cuando ErrorActionPreference está en Stop, por lo que esta
        # consulta puntual debe inspeccionar únicamente su código de salida.
        $previousErrorActionPreference = $ErrorActionPreference
        $previousNativeErrorPreference = $PSNativeCommandUseErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            $PSNativeCommandUseErrorActionPreference = $false
            & gh.exe release view $releaseTag --repo $ReleaseRepository *> $null
            $releaseAlreadyExists = $LASTEXITCODE -eq 0
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
            $PSNativeCommandUseErrorActionPreference = $previousNativeErrorPreference
        }
        if ($releaseAlreadyExists) {
            throw "Ya existe el Release $releaseTag. Incrementa la versión antes de publicar otra actualización."
        }

        Write-Step "Publicando la actualización firmada en GitHub Releases..."
        & gh.exe release create $releaseTag `
            $destination `
            $signatureDestination `
            $latestPath `
            $zipPath `
            $starterZipPath `
            --repo $ReleaseRepository `
            --target main `
            --title "Fortuna Real $releaseTag" `
            --notes "Actualización $releaseTag de Fortuna Real. Incluye mejoras visuales, de rendimiento y jugabilidad."
        if ($LASTEXITCODE -ne 0) {
            throw "GitHub no pudo crear el Release $releaseTag. Los artefactos locales se conservaron."
        }

        Write-Step "Verificando el manifiesto remoto..."
        $remoteManifestUrl = "https://github.com/$ReleaseRepository/releases/latest/download/latest.json"
        $remoteManifest = Wait-ForRemoteManifest -Uri $remoteManifestUrl -ExpectedVersion $version
    }

    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host "       INSTALADOR CREADO CORRECTAMENTE" -ForegroundColor Green
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Archivo para entregar a los usuarios:" -ForegroundColor Cyan
    Write-Host "  $destination" -ForegroundColor White
    Write-Host "  $signatureDestination" -ForegroundColor White
    Write-Host "  $latestPath" -ForegroundColor White
    Write-Host "  $zipPath" -ForegroundColor White
    Write-Host "  $starterZipPath" -ForegroundColor White
    Write-Host "  $ProgramOutput" -ForegroundColor White
    Write-Host "  $LauncherOutput" -ForegroundColor White
    Write-Host ""
    if ($Publish) {
        Write-Host "  Actualización publicada en GitHub Releases con la etiqueta $releaseTag." -ForegroundColor Green
        Write-Host "  Las instalaciones anteriores la detectarán al volver a abrir Fortuna Real." -ForegroundColor Gray
    }
    else {
        Write-Host "  Los usuarios solo deben abrir ese archivo e instalar." -ForegroundColor Gray
        Write-Host "  Para publicar sin exponer la clave, ejecuta: npm run publicar-actualizacion" -ForegroundColor Gray
    }
    Start-Process -FilePath "explorer.exe" -ArgumentList "/select,`"$destination`""
}
catch {
    Write-Host ""
    Write-Host "  No se pudo crear el instalador:" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
}
