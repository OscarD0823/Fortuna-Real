@echo off
chcp 65001 >nul
setlocal EnableExtensions
set "FORTUNA_INSTALLER="
for %%F in ("%~dp0..\2 Instaladores\Fortuna-Real-*-Instalador.exe") do if exist "%%~fF" set "FORTUNA_INSTALLER=%%~fF"
if not defined FORTUNA_INSTALLER (
  echo No se encontro un instalador en la carpeta 2 Instaladores.
  echo Descargalo desde https://github.com/OscarD0823/Fortuna-Real/releases/latest
  pause
  exit /b 1
)
start "" "%FORTUNA_INSTALLER%"
