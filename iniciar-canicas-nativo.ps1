param(
    [switch]$Release
)

$ErrorActionPreference = 'Stop'
$prototypePath = Join-Path $PSScriptRoot 'native-marbles-prototype'

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host ''
    Write-Host '  No se encontro Rust/Cargo.' -ForegroundColor Red
    Write-Host '  Instala Rust antes de abrir el prototipo nativo.' -ForegroundColor Yellow
    Write-Host ''
    Read-Host '  Presiona Enter para cerrar'
    exit 1
}

Write-Host ''
Write-Host '  FORTUNA REAL - PROTOTIPO NATIVO DE CANICAS' -ForegroundColor Cyan
Write-Host '  Preparando el circuito industrial 3D...' -ForegroundColor DarkGray
Write-Host ''

Push-Location $prototypePath
try {
    if ($Release) {
        cargo run --release
    }
    else {
        cargo run
    }
}
finally {
    Pop-Location
}
