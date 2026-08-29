[CmdletBinding()]
param(
    [string]$DestinationPath = "",
    [switch]$CheckOnly,
    [switch]$SkipLaunch
)

$ErrorActionPreference = "Stop"
$Repository = "OscarD0823/Fortuna-Real"
$ExpectedRemote = "https://github.com/OscarD0823/Fortuna-Real.git"

function Write-Step {
    param([string]$Message)
    Write-Host "`n  $Message" -ForegroundColor Cyan
}

function Refresh-Path {
    $paths = @(
        "$env:ProgramFiles\GitHub CLI",
        "$env:LOCALAPPDATA\Programs\GitHub CLI",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
        "$env:ProgramFiles\Git\cmd",
        "$env:LOCALAPPDATA\Programs\Git\cmd",
        "$env:ProgramFiles\nodejs",
        "$env:USERPROFILE\.cargo\bin"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
    foreach ($path in $paths) {
        if (($env:Path -split ';') -notcontains $path) { $env:Path = "$path;$env:Path" }
    }
}

function Select-Destination {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Elige la carpeta donde se descargará Fortuna Real"
    $dialog.ShowNewFolderButton = $true
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
    return Join-Path $dialog.SelectedPath "Fortuna Real"
}

try {
    if ($env:OS -ne "Windows_NT") { throw "Este iniciador está preparado para Windows." }
    try { $Host.UI.RawUI.WindowTitle = "Fortuna Real - Descarga desde GitHub" } catch {}
    Refresh-Path

    if ($CheckOnly) {
        if ($Repository -ne "OscarD0823/Fortuna-Real" -or $ExpectedRemote -notmatch '^https://github\.com/OscarD0823/Fortuna-Real\.git$') {
            throw "La dirección fija del proyecto no es válida."
        }
        Write-Host "Iniciador validado: $Repository"
        exit 0
    }

    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor DarkYellow
    Write-Host "       INSTALAR FORTUNA REAL DESDE GITHUB" -ForegroundColor Yellow
    Write-Host "  ========================================" -ForegroundColor DarkYellow
    Write-Host "  Repositorio privado: GitHub pedirá autorización." -ForegroundColor Gray

    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw "Windows necesita winget. Actualiza 'Instalador de aplicaciones' desde Microsoft Store."
    }
    if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
        Write-Step "Instalando GitHub CLI para realizar la descarga autorizada..."
        & winget.exe install --id GitHub.cli --exact --source winget --scope user --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { throw "No fue posible instalar GitHub CLI (código $LASTEXITCODE)." }
        Refresh-Path
    }
    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
        Write-Step "Instalando Git para preparar la copia del proyecto..."
        & winget.exe install --id Git.Git --exact --source winget --scope user --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { throw "No fue posible instalar Git (código $LASTEXITCODE)." }
        Refresh-Path
    }

    & gh.exe auth status --hostname github.com *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Step "Abriendo la autorización segura de GitHub..."
        & gh.exe auth login --hostname github.com --git-protocol https --web
        if ($LASTEXITCODE -ne 0) { throw "GitHub no autorizó la descarga del repositorio privado." }
    }

    if (-not $DestinationPath) { $DestinationPath = Select-Destination }
    if (-not $DestinationPath) {
        Write-Host "`n  Operación cancelada. No se descargó ningún archivo." -ForegroundColor Yellow
        exit 0
    }
    $DestinationPath = [IO.Path]::GetFullPath($DestinationPath)
    $destinationParent = Split-Path -Parent $DestinationPath
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null

    $gitDirectory = Join-Path $DestinationPath ".git"
    if (Test-Path -LiteralPath $gitDirectory) {
        $remote = (& git.exe -C $DestinationPath remote get-url origin).Trim()
        if ($LASTEXITCODE -ne 0 -or $remote.TrimEnd('/').ToLowerInvariant() -ne $ExpectedRemote.TrimEnd('/').ToLowerInvariant()) {
            throw "La carpeta contiene otro repositorio. Elige una ubicación diferente."
        }
        if (& git.exe -C $DestinationPath status --porcelain) {
            throw "La copia existente tiene cambios sin guardar. Se conservaron intactos; elige otra carpeta."
        }
        Write-Step "Actualizando la copia existente desde la rama main..."
        & git.exe -C $DestinationPath pull --ff-only origin main
        if ($LASTEXITCODE -ne 0) { throw "No se pudo actualizar la copia existente." }
    }
    elseif (Test-Path -LiteralPath $DestinationPath) {
        if ((Get-ChildItem -LiteralPath $DestinationPath -Force | Select-Object -First 1)) {
            throw "La carpeta de destino no está vacía. No se sobrescribió ningún archivo."
        }
        Write-Step "Descargando el proyecto privado desde GitHub..."
        & gh.exe repo clone $Repository $DestinationPath -- --branch main --single-branch
        if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar Fortuna Real." }
    }
    else {
        Write-Step "Descargando el proyecto privado desde GitHub..."
        & gh.exe repo clone $Repository $DestinationPath -- --branch main --single-branch
        if ($LASTEXITCODE -ne 0) { throw "No se pudo descargar Fortuna Real." }
    }

    $sourceLauncher = Join-Path $DestinationPath "iniciar-fortuna.ps1"
    if (-not (Test-Path -LiteralPath $sourceLauncher)) { throw "La descarga terminó incompleta: falta el iniciador del proyecto." }

    Write-Step "Instalando los componentes de Windows que necesita el proyecto..."
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $sourceLauncher -InstallOnly
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron instalar todos los componentes de desarrollo." }

    Set-Location -LiteralPath $DestinationPath
    Write-Step "Instalando exactamente las dependencias declaradas por el proyecto..."
    & npm.cmd ci --prefer-offline --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm no pudo instalar las dependencias del proyecto." }

    Write-Host "`n  Fortuna Real quedó preparado en:" -ForegroundColor Green
    Write-Host "  $DestinationPath" -ForegroundColor White
    if (-not $SkipLaunch) {
        Write-Step "Abriendo Fortuna Real..."
        & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $sourceLauncher
        if ($LASTEXITCODE -ne 0) { throw "El proyecto se instaló, pero no pudo abrirse." }
    }
}
catch {
    Write-Host "`n  No se pudo completar la instalación:" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
