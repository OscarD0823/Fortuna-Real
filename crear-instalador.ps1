[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$Elevated
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallerOutput = Join-Path $ProjectRoot "instaladores"
$SigningKeyPath = Join-Path $env:USERPROFILE ".tauri\fortuna-real.key"
$SigningPasswordPath = "$SigningKeyPath.password"
$ReleaseRepository = "OscarD0823/Fortuna-Real"

function Write-Step {
    param([string]$Message)
    Write-Host "`n  $Message" -ForegroundColor Cyan
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

    Write-Host ""
    Write-Host "  Node.js:            $(if ($hasNode) { 'OK' } else { 'FALTA' })"
    Write-Host "  Rust:               $(if ($hasRust) { 'OK' } else { 'FALTA' })"
    Write-Host "  Compilador Windows: $(if ($hasNativeTools) { 'OK' } else { 'FALTA' })"

    if ($CheckOnly) {
        if ($hasNode -and $hasRust -and $hasNativeTools) { exit 0 }
        exit 2
    }

    $mustInstall = -not ($hasNode -and $hasRust -and $hasNativeTools)
    if ($mustInstall -and -not (Test-Administrator)) {
        Write-Step "Windows pedira permiso para instalar los requisitos que faltan..."
        $arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Elevated"
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
    if (-not (Test-Path -LiteralPath $SigningPasswordPath)) {
        throw "Falta la contrasena de firma en '$SigningPasswordPath'. Restaura la copia de seguridad antes de crear una nueva version."
    }

    $env:TAURI_SIGNING_PRIVATE_KEY = $SigningKeyPath
    $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content -Raw -LiteralPath $SigningPasswordPath).Trim()

    Write-Step "Instalando las dependencias del proyecto..."
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install no pudo completarse."
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
    $latestUpdate | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $latestPath -Encoding utf8

    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host "       INSTALADOR CREADO CORRECTAMENTE" -ForegroundColor Green
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Archivo para entregar a los usuarios:" -ForegroundColor Cyan
    Write-Host "  $destination" -ForegroundColor White
    Write-Host "  $signatureDestination" -ForegroundColor White
    Write-Host "  $latestPath" -ForegroundColor White
    Write-Host ""
    Write-Host "  Los usuarios solo deben abrir ese archivo e instalar." -ForegroundColor Gray
    Write-Host "  Para publicar una actualizacion, sube los tres archivos a GitHub Releases con la etiqueta $releaseTag." -ForegroundColor Gray
}
catch {
    Write-Host ""
    Write-Host "  No se pudo crear el instalador:" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
