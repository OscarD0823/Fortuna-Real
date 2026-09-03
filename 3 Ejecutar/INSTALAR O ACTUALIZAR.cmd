@echo off
chcp 65001 >nul
setlocal EnableExtensions
set "FORTUNA_INSTALLER="
for %%F in ("%~dp0Fortuna-Real-*-Instalador.exe") do if exist "%%~fF" set "FORTUNA_INSTALLER=%%~fF"
if not defined FORTUNA_INSTALLER (
  echo No se encontro el instalador de Fortuna Real junto a este archivo.
  pause
  exit /b 1
)
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Fortuna Real" /v DisplayVersion >nul 2>&1
if %errorlevel% equ 0 (
  echo Actualizando la instalacion existente de Fortuna Real...
  start "" "%FORTUNA_INSTALLER%" /UPDATE
) else (
  echo Instalando Fortuna Real por primera vez...
  start "" "%FORTUNA_INSTALLER%"
)
