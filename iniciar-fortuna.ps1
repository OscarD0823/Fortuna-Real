[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$Elevated,
    [switch]$InstallOnly
)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FortunaPorts = @(1420, 1421)

function Write-Step {
    param([string]$Message)
    Write-Host "`n  $Message" -ForegroundColor Cyan
}

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-ToolPaths {
    $candidatePaths = @(
        "$env:ProgramFiles\nodejs",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
        "$env:USERPROFILE\.cargo\bin"
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

    foreach ($candidatePath in $candidatePaths) {
        if (($env:Path -split ';') -notcontains $candidatePath) {
            $env:Path = "$candidatePath;$env:Path"
        }
    }
}

function Get-VsWherePath {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe",
        "$env:ProgramFiles\Microsoft Visual Studio\Installer\vswhere.exe"
    )

    return $candidates |
        Where-Object { $_ -and (Test-Path -LiteralPath $_) } |
        Select-Object -First 1
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

    Write-Step "Preparando las herramientas de Windows..."
    $environmentLines = & cmd.exe /d /s /c "`"$developerCommand`" -no_logo -arch=x64 -host_arch=x64 >nul && set"
    foreach ($line in $environmentLines) {
        if ($line -match '^([^=]+)=(.*)$') {
            Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
        }
    }

    return [bool](Get-Command link.exe -ErrorAction SilentlyContinue)
}

function Test-RustMsvc {
    if (-not (Get-Command cargo.exe -ErrorAction SilentlyContinue)) {
        return $false
    }

    $hostLine = & rustc.exe -vV 2>$null | Where-Object { $_ -like 'host:*' }
    return [bool]($hostLine -match 'msvc')
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

function Get-FortunaListeners {
    param([int[]]$Ports)

    $connections = foreach ($port in $Ports) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    }
    return @($connections)
}

function Get-RequirementState {
    Refresh-ToolPaths
    return [pscustomobject]@{
        Node = [bool](Get-Command npm.cmd -ErrorAction SilentlyContinue)
        Rust = Test-RustMsvc
        Native = Import-VisualStudioEnvironment
    }
}

try {
    try { $Host.UI.RawUI.WindowTitle = "Fortuna Real - Iniciador" } catch {}
    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor DarkYellow
    Write-Host "             FORTUNA REAL" -ForegroundColor Yellow
    Write-Host "        Sorteos con emocion real" -ForegroundColor Gray
    Write-Host "  ========================================" -ForegroundColor DarkYellow

    $requirements = Get-RequirementState
    Write-Host ""
    Write-Host "  Node.js:            $(if ($requirements.Node) { 'OK' } else { 'FALTA' })"
    Write-Host "  Rust para Windows:  $(if ($requirements.Rust) { 'OK' } else { 'FALTA' })"
    Write-Host "  Compilador C++:     $(if ($requirements.Native) { 'OK' } else { 'FALTA' })"

    if ($CheckOnly) {
        if ($requirements.Node -and $requirements.Rust -and $requirements.Native) { exit 0 }
        exit 2
    }

    $mustInstall = -not ($requirements.Node -and $requirements.Rust -and $requirements.Native)
    if ($mustInstall -and -not (Test-Administrator)) {
        Write-Step "Windows pedira permiso para instalar los componentes que faltan..."
        $arguments = "-NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Elevated -InstallOnly"
        $elevatedProcess = Start-Process `
            -FilePath "powershell.exe" `
            -ArgumentList $arguments `
            -WorkingDirectory $ProjectRoot `
            -Verb RunAs `
            -Wait `
            -PassThru

        if ($elevatedProcess.ExitCode -ne 0) {
            throw "No se completó la instalación de los componentes necesarios."
        }

        $requirements = Get-RequirementState
        $mustInstall = -not ($requirements.Node -and $requirements.Rust -and $requirements.Native)
    }

    if ($mustInstall) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            throw "Falta winget. Actualiza 'Instalador de aplicaciones' desde Microsoft Store."
        }

        if (-not $requirements.Node) {
            Install-WingetPackage -Id "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
            Refresh-ToolPaths
        }

        if (-not $requirements.Rust) {
            if (-not (Get-Command rustup.exe -ErrorAction SilentlyContinue)) {
                Install-WingetPackage -Id "Rustlang.Rustup" -DisplayName "Rust"
                Refresh-ToolPaths
            }
            Write-Step "Activando Rust para aplicaciones de Windows..."
            & rustup.exe default stable-msvc
            if ($LASTEXITCODE -ne 0) {
                throw "Rust se instaló, pero no se pudo activar stable-msvc."
            }
        }

        if (-not $requirements.Native) {
            Install-WingetPackage `
                -Id "Microsoft.VisualStudio.2022.BuildTools" `
                -DisplayName "Visual Studio Build Tools para C++" `
                -Override "--wait --passive --norestart --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
        }

        $requirements = Get-RequirementState
        if (-not ($requirements.Node -and $requirements.Rust -and $requirements.Native)) {
            throw "La instalación terminó, pero Windows necesita reiniciarse. Reinicia y vuelve a abrir Iniciar Fortuna Real.cmd."
        }
    }

    if ($InstallOnly) {
        Write-Host "`n  Componentes instalados correctamente." -ForegroundColor Green
        exit 0
    }

    Write-Step "Comprobando los puertos 1420 y 1421..."
    $listeners = Get-FortunaListeners -Ports $FortunaPorts
    $listenerProcessIds = @(
        $listeners |
            Select-Object -ExpandProperty OwningProcess -Unique |
            Where-Object { $_ -gt 0 -and $_ -ne $PID }
    )

    foreach ($listenerProcessId in $listenerProcessIds) {
        $process = Get-Process -Id $listenerProcessId -ErrorAction SilentlyContinue
        if ($process) {
            $usedPorts = @(
                $listeners |
                    Where-Object { $_.OwningProcess -eq $listenerProcessId } |
                    Select-Object -ExpandProperty LocalPort -Unique
            ) -join ", "

            Write-Host "  Cerrando $($process.ProcessName) (PID $listenerProcessId) en puerto(s) $usedPorts..." -ForegroundColor DarkGray
            try {
                Stop-Process -Id $listenerProcessId -Force -ErrorAction Stop
            }
            catch {
                throw "No se pudo cerrar el proceso $listenerProcessId. Ejecuta el iniciador como administrador."
            }
        }
    }

    Start-Sleep -Milliseconds 350
    $remainingListeners = Get-FortunaListeners -Ports $FortunaPorts
    if ($remainingListeners.Count -gt 0) {
        $busyPorts = @($remainingListeners | Select-Object -ExpandProperty LocalPort -Unique) -join ", "
        throw "Los puertos $busyPorts continúan ocupados."
    }

    Write-Host "  Puertos disponibles." -ForegroundColor Green
    Set-Location -LiteralPath $ProjectRoot

    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules"))) {
        Write-Step "Instalando las dependencias del programa..."
        & npm.cmd install
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudieron instalar las dependencias."
        }
    }

    Write-Step "Abriendo Fortuna Real..."
    & npm.cmd run tauri dev
    $tauriExitCode = $LASTEXITCODE
    if ($tauriExitCode -ne 0) {
        throw "Fortuna Real terminó con el código $tauriExitCode."
    }
}
catch {
    Write-Host ""
    Write-Host "  No se pudo iniciar Fortuna Real:" -ForegroundColor Red
    Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}
